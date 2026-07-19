import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { getZoneColor } from '../../types/lms';
import type { StudentType } from '../../types/lms';
import { getProviderDetails, saveProviderDetails, uploadProfessionalPhoto, uploadAvatar } from '../../lib/vetting';
import { getStudentDetails, saveStudentDetails, uploadStudentDocument, extractDocumentInsights, getStudentTypeLabels } from '../../lib/studentDetails';
import '../../styles/vetting.css';
import '../../styles/messaging.css';

export default function ProfileEditor() {
  const { profile, refreshProfile } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bio, setBio] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [contactPreference, setContactPreference] = useState('');
  const [yearsOfExperience, setYearsOfExperience] = useState('');
  const [offersInPerson, setOffersInPerson] = useState(false);
  const [offersVirtual, setOffersVirtual] = useState(true);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [specialtyDraft, setSpecialtyDraft] = useState('');
  const [rateAmount, setRateAmount] = useState('');
  const [rateCurrency, setRateCurrency] = useState<'USD' | 'EUR' | 'ZAR'>('ZAR');
  const [rateVisible, setRateVisible] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Student "About You" (customer role)
  const [studentType, setStudentType] = useState<StudentType | ''>('');
  const [age, setAge] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [grade, setGrade] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [institutionName, setInstitutionName] = useState('');
  const [courseOfStudy, setCourseOfStudy] = useState('');
  const [yearOfStudy, setYearOfStudy] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [subjectDraft, setSubjectDraft] = useState('');
  const [currentResults, setCurrentResults] = useState('');
  const [occupation, setOccupation] = useState('');
  const [employer, setEmployer] = useState('');
  const [studentYearsExperience, setStudentYearsExperience] = useState('');
  const [goals, setGoals] = useState('');
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [documentSummary, setDocumentSummary] = useState('');
  const [pendingDocumentFile, setPendingDocumentFile] = useState<File | null>(null);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [extractingAI, setExtractingAI] = useState(false);

  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const role = profile?.role ?? 'customer';
  const zone = getZoneColor(role);
  const isProvider = role === 'tutor' || role === 'coach';

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name);
      setLastName(profile.last_name);
      if (!isProvider) setAvatarUrl(profile.avatar_url);
    }
  }, [profile, isProvider]);

  const loadProviderDetails = useCallback(async () => {
    if (!isProvider) return;
    try {
      const details = await getProviderDetails();
      if (details) {
        setBio(details.bio ?? '');
        setQualifications(details.qualifications ?? '');
        setPhone(details.phone_number ?? '');
        setLocation(details.location ?? '');
        setContactPreference(details.contact_preference ?? '');
        setYearsOfExperience(details.years_of_experience?.toString() ?? '');
        setOffersInPerson(details.offers_in_person ?? false);
        setOffersVirtual(details.offers_virtual ?? true);
        setSpecialties(details.specialties ?? []);
        setRateAmount(details.rate_amount?.toString() ?? '');
        setRateCurrency(details.rate_currency ?? 'ZAR');
        setRateVisible(details.rate_visible ?? false);
        setAvatarUrl(details.avatar_url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile details');
    }
  }, [isProvider]);

  useEffect(() => { loadProviderDetails(); }, [loadProviderDetails]);

  const loadStudentDetails = useCallback(async () => {
    if (isProvider) return;
    try {
      const details = await getStudentDetails();
      if (details) {
        setStudentType(details.student_type ?? '');
        setAge(details.age?.toString() ?? '');
        setLocation(details.location ?? '');
        setSchoolName(details.school_name ?? '');
        setGrade(details.grade ?? '');
        setTeacherName(details.teacher_name ?? '');
        setInstitutionName(details.institution_name ?? '');
        setCourseOfStudy(details.course_of_study ?? '');
        setYearOfStudy(details.year_of_study ?? '');
        setSubjects(details.subjects ?? []);
        setCurrentResults(details.current_results ?? '');
        setOccupation(details.occupation ?? '');
        setEmployer(details.employer ?? '');
        setStudentYearsExperience(details.years_experience?.toString() ?? '');
        setGoals(details.goals ?? '');
        setDocumentUrl(details.document_url ?? null);
        setDocumentSummary(details.document_extracted_summary ?? '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load student details');
    }
  }, [isProvider]);

  useEffect(() => { loadStudentDetails(); }, [loadStudentDetails]);

  const handleAddSubject = () => {
    const trimmed = subjectDraft.trim();
    if (trimmed && !subjects.includes(trimmed)) setSubjects([...subjects, trimmed]);
    setSubjectDraft('');
  };

  const handleRemoveSubject = (s: string) => setSubjects(subjects.filter((x) => x !== s));

  const handleDocumentChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingDocumentFile(file);
    setUploadingDocument(true);
    setError(null);
    try {
      const url = await uploadStudentDocument(file);
      setDocumentUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload document');
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleExtractWithAI = async () => {
    if (!pendingDocumentFile) return;
    setExtractingAI(true);
    try {
      const summary = await extractDocumentInsights(pendingDocumentFile);
      setDocumentSummary(summary);
    } finally {
      setExtractingAI(false);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setUploadingPhoto(true);
    setError(null);
    try {
      if (isProvider) {
        const url = await uploadProfessionalPhoto(file);
        setAvatarUrl(url);
      } else {
        const url = await uploadAvatar(file);
        const { error: updateError } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', profile.id);
        if (updateError) throw updateError;
        setAvatarUrl(url);
        await refreshProfile();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleAddSpecialty = () => {
    const trimmed = specialtyDraft.trim();
    if (trimmed && !specialties.includes(trimmed)) setSpecialties([...specialties, trimmed]);
    setSpecialtyDraft('');
  };

  const handleRemoveSpecialty = (s: string) => setSpecialties(specialties.filter((x) => x !== s));

  const handleSave = async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    setSaved(false);

    const draft = specialtyDraft.trim();
    const finalSpecialties = draft && !specialties.includes(draft) ? [...specialties, draft] : specialties;
    const subjectDraftTrimmed = subjectDraft.trim();
    const finalSubjects = subjectDraftTrimmed && !subjects.includes(subjectDraftTrimmed) ? [...subjects, subjectDraftTrimmed] : subjects;

    try {
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ first_name: firstName, last_name: lastName, updated_at: new Date().toISOString() })
        .eq('id', profile.id);

      if (profileErr) throw profileErr;

      if (isProvider) {
        await saveProviderDetails({
          bio,
          qualifications,
          phone_number: phone,
          location,
          contact_preference: contactPreference,
          years_of_experience: yearsOfExperience ? Number(yearsOfExperience) : null,
          offers_in_person: offersInPerson,
          offers_virtual: offersVirtual,
          specialties: finalSpecialties,
          rate_amount: rateAmount ? Number(rateAmount) : null,
          rate_currency: rateCurrency,
          rate_visible: rateVisible,
        });
      } else {
        await saveStudentDetails({
          student_type: studentType || null,
          age: age ? Number(age) : null,
          location,
          school_name: schoolName,
          grade,
          teacher_name: teacherName,
          institution_name: institutionName,
          course_of_study: courseOfStudy,
          year_of_study: yearOfStudy,
          subjects: finalSubjects,
          current_results: currentResults,
          occupation,
          employer,
          years_experience: studentYearsExperience ? Number(studentYearsExperience) : null,
          goals,
          document_url: documentUrl,
          document_extracted_summary: documentSummary,
        });
        setSubjects(finalSubjects);
        setSubjectDraft('');
      }

      setSpecialties(finalSpecialties);
      setSpecialtyDraft('');
      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const zoneColor = zone === 'tutor'
    ? 'var(--zone-tutor)'
    : zone === 'coach'
      ? 'var(--zone-coach)'
      : zone === 'admin'
        ? 'var(--zone-admin)'
        : 'var(--zone-student)';

  const zoneBg = zone === 'tutor'
    ? 'var(--zone-tutor-light)'
    : zone === 'coach'
      ? 'var(--zone-coach-light)'
      : zone === 'admin'
        ? 'var(--zone-admin-light)'
        : 'var(--zone-student-light)';

  const zoneGradient = zone === 'tutor'
    ? 'var(--zone-tutor-gradient)'
    : zone === 'coach'
      ? 'var(--zone-coach-gradient)'
      : zone === 'admin'
        ? 'var(--zone-admin-gradient)'
        : 'var(--zone-student-gradient)';

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.7rem 0.85rem',
    borderRadius: '8px',
    border: '1px solid rgba(0, 0, 0, 0.12)',
    fontFamily: 'inherit',
    fontSize: '0.9rem',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.82rem',
    fontWeight: 600,
    marginBottom: '0.35rem',
    color: 'var(--color-text-main)',
  };

  return (
    <div className="animate-slide-up">
      <div className="dashboard-page-header">
        <h1 className="dashboard-page-title">My Profile</h1>
        <p className="dashboard-page-subtitle">
          {isProvider ? 'Manage your public directory profile and preferences.' : 'Manage your personal information and preferences.'}
        </p>
      </div>

      {/* Avatar + Zone Banner */}
      <div className="content-panel" style={{ marginBottom: '1.5rem', overflow: 'visible' }}>
        <div style={{ height: '100px', background: zoneGradient, borderRadius: '12px 12px 0 0', position: 'relative' }}>
          <div style={{
            position: 'absolute',
            bottom: '-32px',
            left: '1.5rem',
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: avatarUrl ? `#fff` : '#fff',
            backgroundImage: avatarUrl ? `url(${avatarUrl})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            border: `3px solid ${zoneColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            fontWeight: 800,
            color: zoneColor,
            boxShadow: 'var(--shadow-md)',
          }}>
            {!avatarUrl && (profile ? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase() : '?')}
          </div>
        </div>
        <div style={{ padding: '2.75rem 1.5rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
              {profile?.first_name} {profile?.last_name}
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              {profile?.email} • {role === 'tutor' ? '🎓 Tutor' : role === 'coach' ? '🤝 Coach' : role === 'admin' ? '🛡️ Admin' : '📖 Student'}
            </p>
          </div>
          <label className="btn btn-outline" style={{ cursor: 'pointer', fontSize: '0.85rem' }}>
            {uploadingPhoto ? 'Uploading...' : avatarUrl ? 'Change photo' : 'Upload photo'}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhotoChange} hidden disabled={uploadingPhoto} />
          </label>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div style={{ padding: '0.75rem 1rem', background: '#FFEBEE', border: '1px solid #EF9A9A', borderRadius: '8px', color: '#C62828', fontSize: '0.85rem', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {saved && (
        <div style={{
          padding: '0.75rem 1rem', background: zoneBg, border: `1px solid ${zoneColor}`, borderRadius: '8px',
          color: zone === 'tutor' ? 'var(--zone-tutor-dark)' : zone === 'coach' ? 'var(--zone-coach-dark)' : zone === 'admin' ? 'var(--zone-admin-dark)' : 'var(--zone-student-dark)',
          fontSize: '0.85rem', marginBottom: '1rem',
        }}>
          ✅ Profile saved successfully!
        </div>
      )}

      {/* Profile Form */}
      <div className="content-panel" style={{ marginBottom: '1.5rem' }}>
        <div className="content-panel-header">
          <h3 className="content-panel-title">Personal Information</h3>
        </div>
        <div className="content-panel-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', maxWidth: '600px' }}>
            <div>
              <label style={labelStyle}>First Name</label>
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Last Name</label>
              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div style={{ marginTop: '1rem', maxWidth: '600px' }}>
            <label style={labelStyle}>Email Address</label>
            <input type="email" value={profile?.email ?? ''} disabled style={{ ...inputStyle, background: '#f5f5f5', cursor: 'not-allowed' }} />
            <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
              Email cannot be changed here. Contact support if needed.
            </p>
          </div>
        </div>
      </div>

      {/* Provider Details (Tutors & Coaches only) */}
      {isProvider && (
        <>
          <div className="content-panel" style={{ marginBottom: '1.5rem' }}>
            <div className="content-panel-header">
              <h3 className="content-panel-title">{role === 'tutor' ? '🎓 Tutor Details' : '🤝 Coach Details'}</h3>
            </div>
            <div className="content-panel-body" style={{ maxWidth: '600px' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Bio</label>
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Tell students about your experience, teaching style, and specializations..."
                  rows={4}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: '100px' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Qualifications</label>
                <input
                  type="text"
                  value={qualifications}
                  onChange={e => setQualifications(e.target.value)}
                  placeholder="e.g. BSc Mathematics, PGCE, ICF Certified Coach"
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Specialities</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    value={specialtyDraft}
                    onChange={(e) => setSpecialtyDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSpecialty(); } }}
                    placeholder="e.g. Mathematics, Case Interviews..."
                    style={inputStyle}
                  />
                  <button type="button" className="btn btn-outline btn-sm" onClick={handleAddSpecialty}>Add</button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
                  {specialties.map((s) => (
                    <span key={s} className="vetting-tag">
                      {s}
                      <button type="button" onClick={() => handleRemoveSpecialty(s)}>&times;</button>
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>Phone Number</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+27 XX XXX XXXX" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Location</label>
                  <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Johannesburg, South Africa" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Years of experience</label>
                  <input type="number" min={0} value={yearsOfExperience} onChange={e => setYearsOfExperience(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Preferred contact method</label>
                  <input type="text" value={contactPreference} onChange={e => setContactPreference(e.target.value)} placeholder="Email, WhatsApp..." style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                  <input type="checkbox" checked={offersVirtual} onChange={(e) => setOffersVirtual(e.target.checked)} /> Offers virtual sessions
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                  <input type="checkbox" checked={offersInPerson} onChange={(e) => setOffersInPerson(e.target.checked)} /> Offers in-person sessions
                </label>
              </div>
            </div>
          </div>

          <div className="content-panel" style={{ marginBottom: '1.5rem' }}>
            <div className="content-panel-header">
              <h3 className="content-panel-title">Rate (optional)</h3>
            </div>
            <div className="content-panel-body" style={{ maxWidth: '600px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>Amount</label>
                  <input type="number" min={0} step="1" value={rateAmount} onChange={e => setRateAmount(e.target.value)} placeholder="e.g. 350" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Currency</label>
                  <select value={rateCurrency} onChange={(e) => setRateCurrency(e.target.value as 'USD' | 'EUR' | 'ZAR')} style={inputStyle}>
                    <option value="ZAR">ZAR (R)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', marginTop: '1rem' }}>
                <input type="checkbox" checked={rateVisible} onChange={(e) => setRateVisible(e.target.checked)} /> Show this rate on my public profile
              </label>
            </div>
          </div>
        </>
      )}

      {/* About You (Students only) */}
      {!isProvider && (
        <div className="content-panel" style={{ marginBottom: '1.5rem' }}>
          <div className="content-panel-header">
            <h3 className="content-panel-title">🎯 About You</h3>
          </div>
          <div className="content-panel-body" style={{ maxWidth: '600px' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: 0, marginBottom: '1.25rem' }}>
              These help your tutor or coach prepare and tailor their approach — completely optional, but the more they know, the more value you'll get from each session.
            </p>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={labelStyle}>I am a...</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {([
                  ['scholar', 'Scholar (school-going)'],
                  ['student', 'Student (university/tertiary)'],
                  ['professional', 'Professional (working)'],
                  ['', 'Prefer not to say'],
                ] as [StudentType | '', string][]).map(([value, label]) => (
                  <button
                    key={value || 'none'}
                    type="button"
                    onClick={() => setStudentType(value)}
                    style={{
                      padding: '0.55rem 0.9rem', borderRadius: '20px', fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit',
                      border: studentType === value ? `1.5px solid ${zoneColor}` : '1.5px solid #e2e8f0',
                      background: studentType === value ? zoneColor : '#fff',
                      color: studentType === value ? '#fff' : '#334155',
                      fontWeight: studentType === value ? 600 : 500,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {studentType && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={labelStyle}>Age</label>
                    <input type="number" min={0} value={age} onChange={e => setAge(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Location</label>
                    <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Cape Town, South Africa" style={inputStyle} />
                  </div>
                </div>

                {(studentType === 'scholar' || studentType === 'student') && (() => {
                  const labels = getStudentTypeLabels(studentType);
                  return (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                        <div>
                          <label style={labelStyle}>{labels.institutionLabel}</label>
                          <input
                            type="text"
                            value={studentType === 'scholar' ? schoolName : institutionName}
                            onChange={e => studentType === 'scholar' ? setSchoolName(e.target.value) : setInstitutionName(e.target.value)}
                            style={inputStyle}
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>{labels.subLabel}</label>
                          <input
                            type="text"
                            value={studentType === 'scholar' ? grade : courseOfStudy}
                            onChange={e => studentType === 'scholar' ? setGrade(e.target.value) : setCourseOfStudy(e.target.value)}
                            style={inputStyle}
                          />
                        </div>
                      </div>

                      <div style={{ marginBottom: '1rem' }}>
                        <label style={labelStyle}>{labels.contactLabel}</label>
                        <input
                          type="text"
                          value={studentType === 'scholar' ? teacherName : yearOfStudy}
                          onChange={e => studentType === 'scholar' ? setTeacherName(e.target.value) : setYearOfStudy(e.target.value)}
                          style={inputStyle}
                        />
                      </div>

                      <div style={{ marginBottom: '1rem' }}>
                        <label style={labelStyle}>Subjects / courses currently studying</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input
                            type="text"
                            value={subjectDraft}
                            onChange={(e) => setSubjectDraft(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubject(); } }}
                            placeholder="e.g. Physics, English..."
                            style={inputStyle}
                          />
                          <button type="button" className="btn btn-outline btn-sm" onClick={handleAddSubject}>Add</button>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
                          {subjects.map((s) => (
                            <span key={s} className="vetting-tag">
                              {s}
                              <button type="button" onClick={() => handleRemoveSubject(s)}>&times;</button>
                            </span>
                          ))}
                        </div>
                      </div>

                      <div style={{ marginBottom: '1rem' }}>
                        <label style={labelStyle}>Current results</label>
                        <input
                          type="text"
                          value={currentResults}
                          onChange={e => setCurrentResults(e.target.value)}
                          placeholder="e.g. 82% average, up from 74% last term"
                          style={inputStyle}
                        />
                      </div>

                      <div style={{ marginBottom: '0.5rem' }}>
                        <label style={labelStyle}>Upload {labels.documentLabel}</label>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
                            {uploadingDocument ? 'Uploading...' : documentUrl ? `Change ${labels.documentLabel.toLowerCase()}` : `Upload ${labels.documentLabel.toLowerCase()}`}
                            <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={handleDocumentChange} hidden disabled={uploadingDocument} />
                          </label>
                          {pendingDocumentFile && (
                            <button type="button" className="btn btn-outline btn-sm" onClick={handleExtractWithAI} disabled={extractingAI}>
                              {extractingAI ? 'Extracting...' : '✨ Extract with AI'}
                            </button>
                          )}
                          {documentUrl && (
                            <a href={documentUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.82rem' }}>View uploaded file</a>
                          )}
                        </div>
                        {documentSummary && (
                          <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f5f3ff', borderRadius: '8px', fontSize: '0.85rem', color: '#5b21b6' }}>
                            <strong>Extracted Summary:</strong> {documentSummary}
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}

                {studentType === 'professional' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <label style={labelStyle}>Occupation</label>
                        <input type="text" value={occupation} onChange={e => setOccupation(e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Current employer</label>
                        <input type="text" value={employer} onChange={e => setEmployer(e.target.value)} style={inputStyle} />
                      </div>
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={labelStyle}>Years of experience</label>
                      <input type="number" min={0} value={studentYearsExperience} onChange={e => setStudentYearsExperience(e.target.value)} style={inputStyle} />
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={labelStyle}>What would you like to achieve?</label>
                      <textarea
                        value={goals}
                        onChange={e => setGoals(e.target.value)}
                        placeholder="e.g. Prepare for a management consulting interview..."
                        rows={3}
                        style={{ ...inputStyle, resize: 'vertical' }}
                      />
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Save Button */}
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={loading} style={{ padding: '0.75rem 2rem', background: zoneColor }}>
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
