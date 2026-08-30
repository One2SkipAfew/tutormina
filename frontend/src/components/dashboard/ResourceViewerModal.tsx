import { useState, useEffect, useRef } from 'react';
import type { SharedFile } from '../../types/lms';
import { formatFileSize } from '../../types/lms';
import { downloadFile, updateFile } from '../../lib/sharedDrive';
import { summariseFile, generateInsights } from '../../lib/aiApi';
import {
  X,
  Download,
  Sparkles,
  Search,
  FileText,
  Film,
  Edit3,
  Book,
  BookOpen,
  Mic,
  Paperclip,
  Loader,
  Play,
  Pause,
  Volume2,
  VolumeX,
  CheckCircle2,
  List
} from 'lucide-react';

interface ResourceViewerModalProps {
  file: SharedFile;
  onClose: () => void;
  onFileUpdated?: (updatedFile: SharedFile) => void;
}

const getIconForFileType = (type: string, size = 20) => {
  switch (type) {
    case 'document': return <FileText size={size} />;
    case 'video': return <Film size={size} />;
    case 'past_paper': return <Edit3 size={size} />;
    case 'notes': return <Book size={size} />;
    case 'course_material': return <BookOpen size={size} />;
    case 'recording': return <Mic size={size} />;
    default: return <Paperclip size={size} />;
  }
};

export default function ResourceViewerModal({
  file,
  onClose,
  onFileUpdated,
}: ResourceViewerModalProps) {
  const [currentFile, setCurrentFile] = useState<SharedFile>(file);
  const [activeTab, setActiveTab] = useState<'content' | 'ai' | 'transcript'>('content');
  const [summarising, setSummarising] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState(false);

  // Native Audio Visualizer Player State
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const fileUrl = currentFile.file_url || '';
  const ext = (fileUrl.split('?')[0].split('.').pop() || '').toLowerCase();
  const mimeType = (currentFile.mime_type || '').toLowerCase();

  const isPdf = ext === 'pdf' || mimeType.includes('pdf');
  const isAudio = ['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext) || mimeType.startsWith('audio/') || currentFile.file_type === 'recording';
  const isVideo = ['mp4', 'webm', 'mov', 'mkv', 'ogv'].includes(ext) || mimeType.startsWith('video/') || currentFile.file_type === 'video';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext) || mimeType.startsWith('image/');
  const isText = ['txt', 'md', 'json', 'csv', 'log', 'xml'].includes(ext) || mimeType.startsWith('text/');

  // Load text file content if text/markdown
  useEffect(() => {
    if (isText && fileUrl && !textContent) {
      setLoadingText(true);
      fetch(fileUrl)
        .then(res => res.text())
        .then(text => setTextContent(text))
        .catch(err => console.error('Failed to load text content:', err))
        .finally(() => setLoadingText(false));
    }
  }, [isText, fileUrl]);

  // Audio player listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, [isAudio]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleSpeedChange = (speed: number) => {
    if (!audioRef.current) return;
    audioRef.current.playbackRate = speed;
    setPlaybackRate(speed);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // AI Summarise
  const handleSummarise = async () => {
    if (summarising || !fileUrl) return;
    setSummarising(true);
    try {
      // Fetch file as blob to send to AI endpoint
      const res = await fetch(fileUrl);
      const blob = await res.blob();
      const blobFile = new File([blob], currentFile.title || 'document', { type: blob.type });

      const aiResult = await summariseFile(blobFile);
      const updated = await updateFile(currentFile.id, {
        ai_summary: aiResult.summary,
        ai_insights: aiResult.insights,
        ai_key_topics: aiResult.key_topics,
      });

      setCurrentFile(prev => ({
        ...prev,
        ai_summary: updated.ai_summary,
        ai_insights: updated.ai_insights,
        ai_key_topics: updated.ai_key_topics,
      }));

      if (onFileUpdated) onFileUpdated(updated);
      setActiveTab('ai');
    } catch (err) {
      console.error('Failed to summarise file:', err);
    } finally {
      setSummarising(false);
    }
  };

  // AI Extract Insights
  const handleExtractInsights = async () => {
    if (extracting || !fileUrl) return;
    setExtracting(true);
    try {
      let textToAnalyze = textContent || currentFile.description || currentFile.title;
      if (!textContent) {
        const res = await fetch(fileUrl);
        const blob = await res.blob();
        const blobFile = new File([blob], currentFile.title || 'document', { type: blob.type });
        const aiResult = await summariseFile(blobFile);
        textToAnalyze = aiResult.summary;
      }

      const insightsRes = await generateInsights(textToAnalyze);
      const updated = await updateFile(currentFile.id, {
        ai_insights: insightsRes.insights,
        ai_key_topics: insightsRes.key_topics,
        ai_summary: currentFile.ai_summary || insightsRes.summary,
      });

      setCurrentFile(prev => ({
        ...prev,
        ai_insights: updated.ai_insights,
        ai_key_topics: updated.ai_key_topics,
        ai_summary: prev.ai_summary || updated.ai_summary,
      }));

      if (onFileUpdated) onFileUpdated(updated);
      setActiveTab('ai');
    } catch (err) {
      console.error('Failed to extract insights:', err);
    } finally {
      setExtracting(false);
    }
  };

  // Download
  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadFile(currentFile);
    } catch (err) {
      console.error('Download failed, opening directly:', err);
      window.open(fileUrl, '_blank');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '1080px',
          height: '88vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header Toolbar */}
        <div
          style={{
            padding: '0.9rem 1.5rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: '#e0f2fe',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {getIconForFileType(currentFile.file_type, 20)}
            </div>
            <div style={{ minWidth: 0 }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  color: '#0f172a',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {currentFile.title}
              </h3>
              <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span>{formatFileSize(currentFile.file_size_bytes)}</span>
                <span>•</span>
                <span>Uploaded by {currentFile.uploader_name || 'TutorMina'}</span>
                <span>•</span>
                <span style={{ textTransform: 'capitalize' }}>{currentFile.file_type.replace('_', ' ')}</span>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            <button
              onClick={handleSummarise}
              disabled={summarising}
              style={{
                padding: '0.45rem 0.9rem',
                borderRadius: '8px',
                border: '1px solid #c084fc',
                background: summarising ? '#f3e8ff' : '#faf5ff',
                color: '#7e22ce',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s ease',
              }}
            >
              {summarising ? <Loader size={14} className="spin" /> : <Sparkles size={14} />}
              {summarising ? 'Summarising…' : 'Summarise with AI'}
            </button>

            <button
              onClick={handleExtractInsights}
              disabled={extracting}
              style={{
                padding: '0.45rem 0.9rem',
                borderRadius: '8px',
                border: '1px solid #38bdf8',
                background: extracting ? '#e0f2fe' : '#f0f9ff',
                color: '#0369a1',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s ease',
              }}
            >
              {extracting ? <Loader size={14} className="spin" /> : <Search size={14} />}
              {extracting ? 'Extracting…' : 'Extract Insights'}
            </button>

            <button
              onClick={handleDownload}
              disabled={downloading}
              style={{
                padding: '0.45rem 0.9rem',
                borderRadius: '8px',
                border: '1px solid #16a34a',
                background: '#16a34a',
                color: '#ffffff',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s ease',
              }}
            >
              {downloading ? <Loader size={14} className="spin" /> : <Download size={14} />}
              {downloading ? 'Downloading…' : 'Download'}
            </button>

            <button
              onClick={onClose}
              style={{
                border: 'none',
                background: '#f1f5f9',
                color: '#64748b',
                padding: '0.45rem',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: '0.25rem',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* View Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#ffffff', padding: '0 1.5rem' }}>
          <button
            onClick={() => setActiveTab('content')}
            style={{
              padding: '0.65rem 1rem',
              border: 'none',
              borderBottom: activeTab === 'content' ? '2px solid #0284c7' : '2px solid transparent',
              background: 'none',
              fontWeight: activeTab === 'content' ? 700 : 500,
              color: activeTab === 'content' ? '#0284c7' : '#64748b',
              cursor: 'pointer',
              fontSize: '0.87rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <FileText size={16} /> Content View
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            style={{
              padding: '0.65rem 1rem',
              border: 'none',
              borderBottom: activeTab === 'ai' ? '2px solid #7e22ce' : '2px solid transparent',
              background: 'none',
              fontWeight: activeTab === 'ai' ? 700 : 500,
              color: activeTab === 'ai' ? '#7e22ce' : '#64748b',
              cursor: 'pointer',
              fontSize: '0.87rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <Sparkles size={16} /> AI Summary &amp; Insights
            {currentFile.ai_summary && (
              <span style={{ fontSize: '0.68rem', background: '#f3e8ff', color: '#7e22ce', padding: '1px 6px', borderRadius: '10px' }}>
                Ready
              </span>
            )}
          </button>

          {(currentFile as any)._aiNote?.transcript && (
            <button
              onClick={() => setActiveTab('transcript')}
              style={{
                padding: '0.65rem 1rem',
                border: 'none',
                borderBottom: activeTab === 'transcript' ? '2px solid #059669' : '2px solid transparent',
                background: 'none',
                fontWeight: activeTab === 'transcript' ? 700 : 500,
                color: activeTab === 'transcript' ? '#059669' : '#64748b',
                cursor: 'pointer',
                fontSize: '0.87rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <List size={16} /> Full Transcript
            </button>
          )}
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#f8fafc', padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
          {activeTab === 'content' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* PDF Viewer */}
              {isPdf && fileUrl && (
                <div style={{ flex: 1, minHeight: '520px', borderRadius: '10px', overflow: 'hidden', border: '1px solid #cbd5e1', background: '#ffffff' }}>
                  <iframe
                    src={fileUrl}
                    title={currentFile.title}
                    style={{ width: '100%', height: '100%', minHeight: '520px', border: 'none' }}
                  />
                </div>
              )}

              {/* Native Audio Player with Visualizer */}
              {isAudio && (
                <div
                  style={{
                    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                    borderRadius: '16px',
                    padding: '2.5rem 2rem',
                    color: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '1.5rem',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25)',
                    margin: 'auto 0',
                  }}
                >
                  <audio ref={audioRef} src={fileUrl} preload="metadata" />

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)',
                      }}
                    >
                      <Mic size={28} color="#ffffff" />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>{currentFile.title}</h4>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
                        Audio Recording • {formatFileSize(currentFile.file_size_bytes)}
                      </p>
                    </div>
                  </div>

                  {/* Animated Visual Waveform Bars */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '48px', padding: '0 1rem' }}>
                    {Array.from({ length: 36 }).map((_, i) => {
                      const baseHeight = ((Math.sin(i * 0.4) + 1) / 2) * 32 + 8;
                      const activeHeight = isPlaying ? Math.min(48, baseHeight * (1 + Math.sin(Date.now() / 200 + i) * 0.4)) : baseHeight;
                      return (
                        <div
                          key={i}
                          style={{
                            width: '4px',
                            height: `${activeHeight}px`,
                            borderRadius: '4px',
                            background: isPlaying
                              ? 'linear-gradient(180deg, #a855f7 0%, #3b82f6 100%)'
                              : 'rgba(255, 255, 255, 0.2)',
                            transition: 'height 0.15s ease',
                          }}
                        />
                      );
                    })}
                  </div>

                  {/* Scrubber & Time */}
                  <div style={{ width: '100%', maxWidth: '540px' }}>
                    <input
                      type="range"
                      min={0}
                      max={duration || 100}
                      value={currentTime}
                      onChange={handleSeek}
                      style={{
                        width: '100%',
                        cursor: 'pointer',
                        accentColor: '#8b5cf6',
                        height: '6px',
                        borderRadius: '3px',
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.3rem' }}>
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>

                  {/* Controls */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <button
                      onClick={toggleMute}
                      style={{
                        border: 'none',
                        background: 'rgba(255, 255, 255, 0.1)',
                        color: '#ffffff',
                        padding: '0.6rem',
                        borderRadius: '50%',
                        cursor: 'pointer',
                      }}
                    >
                      {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </button>

                    <button
                      onClick={togglePlay}
                      style={{
                        border: 'none',
                        background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                        color: '#ffffff',
                        width: '52px',
                        height: '52px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)',
                        transition: 'transform 0.1s ease',
                      }}
                    >
                      {isPlaying ? <Pause size={24} /> : <Play size={24} style={{ marginLeft: '2px' }} />}
                    </button>

                    {/* Speed Selector */}
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      {[1, 1.25, 1.5, 2].map(speed => (
                        <button
                          key={speed}
                          onClick={() => handleSpeedChange(speed)}
                          style={{
                            border: 'none',
                            background: playbackRate === speed ? '#8b5cf6' : 'rgba(255, 255, 255, 0.1)',
                            color: '#ffffff',
                            padding: '0.3rem 0.55rem',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {speed}x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Video Player */}
              {isVideo && fileUrl && (
                <div style={{ borderRadius: '12px', overflow: 'hidden', background: '#000000', margin: 'auto 0' }}>
                  <video
                    controls
                    src={fileUrl}
                    style={{ width: '100%', maxHeight: '540px', display: 'block' }}
                  />
                </div>
              )}

              {/* Image Preview */}
              {isImage && fileUrl && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', padding: '1rem' }}>
                  <img
                    src={fileUrl}
                    alt={currentFile.title}
                    style={{ maxWidth: '100%', maxHeight: '520px', objectFit: 'contain', borderRadius: '8px' }}
                  />
                </div>
              )}

              {/* Text / Markdown Content */}
              {isText && (
                <div style={{ flex: 1, background: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', padding: '1.5rem', overflowY: 'auto' }}>
                  {loadingText ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                      <Loader size={20} className="spin" /> Loading text content...
                    </div>
                  ) : (
                    <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '0.9rem', whiteSpace: 'pre-wrap', lineHeight: '1.6', color: '#1e293b' }}>
                      {textContent || 'No content loaded.'}
                    </pre>
                  )}
                </div>
              )}

              {/* Fallback for other file types */}
              {!isPdf && !isAudio && !isVideo && !isImage && !isText && (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #cbd5e1',
                    padding: '3rem',
                    textAlign: 'center',
                    gap: '1rem',
                  }}
                >
                  <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: '#f1f5f9', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {getIconForFileType(currentFile.file_type, 32)}
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>{currentFile.title}</h4>
                    <p style={{ margin: '0.3rem 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                      This file format can be downloaded or summarized using AI above.
                    </p>
                  </div>
                  <button
                    onClick={handleDownload}
                    className="btn btn-primary"
                    style={{ padding: '0.65rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}
                  >
                    <Download size={16} /> Download File
                  </button>
                </div>
              )}
            </div>
          )}

          {/* AI Tab */}
          {activeTab === 'ai' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Summary Card */}
              <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: '#7e22ce' }}>
                  <Sparkles size={18} />
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>AI Summary</h4>
                </div>
                {currentFile.ai_summary ? (
                  <div style={{ fontSize: '0.92rem', color: '#334155', lineHeight: '1.65', whiteSpace: 'pre-wrap' }}>
                    {currentFile.ai_summary}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                    <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem' }}>No AI summary generated for this resource yet.</p>
                    <button
                      onClick={handleSummarise}
                      disabled={summarising}
                      className="btn btn-primary"
                      style={{ background: '#7e22ce', borderColor: '#7e22ce', fontSize: '0.85rem' }}
                    >
                      {summarising ? 'Generating...' : '✨ Generate AI Summary Now'}
                    </button>
                  </div>
                )}
              </div>

              {/* Key Topics & Insights Card */}
              <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: '#0284c7' }}>
                  <Search size={18} />
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>Key Topics &amp; Educational Insights</h4>
                </div>

                {currentFile.ai_key_topics && currentFile.ai_key_topics.length > 0 && (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '0.4rem' }}>Extracted Topics:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {currentFile.ai_key_topics.map((topic, i) => (
                        <span
                          key={i}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '16px',
                            background: '#e0f2fe',
                            color: '#0369a1',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                          }}
                        >
                          #{topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {currentFile.ai_insights && currentFile.ai_insights.length > 0 ? (
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '0.4rem' }}>Actionable Insights:</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {currentFile.ai_insights.map((insight, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.5rem',
                            fontSize: '0.88rem',
                            color: '#334155',
                            padding: '0.4rem 0',
                          }}
                        >
                          <CheckCircle2 size={16} color="#16a34a" style={{ flexShrink: 0, marginTop: '2px' }} />
                          <span>{insight}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  !currentFile.ai_key_topics?.length && (
                    <div style={{ textAlign: 'center', padding: '1rem', color: '#64748b' }}>
                      <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem' }}>No insights extracted yet.</p>
                      <button
                        onClick={handleExtractInsights}
                        disabled={extracting}
                        className="btn btn-outline"
                        style={{ fontSize: '0.85rem', color: '#0284c7', borderColor: '#0284c7' }}
                      >
                        {extracting ? 'Extracting...' : '💡 Extract Insights & Key Topics'}
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* Full Transcript Tab */}
          {activeTab === 'transcript' && (
            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>Full Session Transcript</h4>
              <div style={{ fontSize: '0.9rem', color: '#334155', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>
                {(currentFile as any)._aiNote?.transcript || 'No transcript text available.'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
