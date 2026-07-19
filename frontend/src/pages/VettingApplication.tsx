import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { WorkExperience, ProfessionalReference } from '../types/lms';
import {
  uploadProfessionalPhoto,
  getProviderDetails,
  saveProviderDetails,
  getWorkExperiences,
  addWorkExperience,
  deleteWorkExperience,
  getReferences,
  addReference,
  deleteReference,
  submitApplication,
} from '../lib/vetting';
import '../styles/vetting.css';

export default function VettingApplication() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [bio, setBio] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [specialtyDraft, setSpecialtyDraft] = useState('');
  const [yearsOfExperience, setYearsOfExperience] = useState('');
  const [location, setLocation] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [contactPreference, setContactPreference] = useState('');
  const [offersInPerson, setOffersInPerson] = useState(false);
  const [offersVirtual, setOffersVirtual] = useState(true);
  const [rateAmount, setRateAmount] = useState('');
  const [rateCurrency, setRateCurrency] = useState<'USD' | 'EUR' | 'ZAR'>('ZAR');
  const [rateVisible, setRateVisible] = useState(false);

  const [workExperiences, setWorkExperiences] = useState<WorkExperience[]>([]);
  const [weCompany, setWeCompany] = useState('');
  const [weTitle, setWeTitle] = useState('');
  const [weStart, setWeStart] = useState('');
  const [weEnd, setWeEnd] = useState('');
  const [weDescription, setWeDescription] = useState('');

  const [references, setReferences] = useState<ProfessionalReference[]>([]);
  const [refName, setRefName] = useState('');
  const [refRelationship, setRefRelationship] = useState('');
  const [refContact, setRefContact] = useState('');
  const [refComment, setRefComment] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [details, we, refs] = await Promise.all([
        getProviderDetails(),
        getWorkExperiences(),
        getReferences(),
      ]);
      if (details) {
        setAvatarUrl(details.avatar_url);
        setBio(details.bio ?? '');
        setQualifications(details.qualifications ?? '');
        setSpecialties(details.specialties ?? []);
        setYearsOfExperience(details.years_of_experience?.toString() ?? '');
        setLocation(details.location ?? '');
        setPhoneNumber(details.phone_number ?? '');
        setContactPreference(details.contact_preference ?? '');
        setOffersInPerson(details.offers_in_person ?? false);
        setOffersVirtual(details.offers_virtual ?? true);
        setRateAmount(details.rate_amount?.toString() ?? '');
        setRateCurrency(details.rate_currency ?? 'ZAR');
        setRateVisible(details.rate_visible ?? false);
      }
      setWorkExperiences(we);
      setReferences(refs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load application');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    setError(null);
    try {
      const url = await uploadProfessionalPhoto(file);
      setAvatarUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleAddSpecialty = () => {
    const trimmed = specialtyDraft.trim();
    if (trimmed && !specialties.includes(trimmed)) {
      setSpecialties([...specialties, trimmed]);
    }
    setSpecialtyDraft('');
  };

  const handleRemoveSpecialty = (s: string) => setSpecialties(specialties.filter((x) => x !== s));

  const handleSaveDetails = async () => {
    setSaving(true);
    setError(null);
    const draft = specialtyDraft.trim();
    const finalSpecialties = draft && !specialties.includes(draft) ? [...specialties, draft] : specialties;
    try {
      await saveProviderDetails({
        bio,
        qualifications,
        specialties: finalSpecialties,
        years_of_experience: yearsOfExperience ? Number(yearsOfExperience) : null,
        location,
        phone_number: phoneNumber,
        contact_preference: contactPreference,
        offers_in_person: offersInPerson,
        offers_virtual: offersVirtual,
        rate_amount: rateAmount ? Number(rateAmount) : null,
        rate_currency: rateCurrency,
        rate_visible: rateVisible,
      });
      setSpecialties(finalSpecialties);
      setSpecialtyDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save details');
    } finally {
      setSaving(false);
    }
  };

  const handleAddWorkExperience = async () => {
    if (!weCompany.trim() || !weTitle.trim()) return;
    try {
      const entry = await addWorkExperience({
        company: weCompany,
        title: weTitle,
        start_date: weStart || null,
        end_date: weEnd || null,
        description: weDescription || null,
      });
      setWorkExperiences([entry, ...workExperiences]);
      setWeCompany(''); setWeTitle(''); setWeStart(''); setWeEnd(''); setWeDescription('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add work experience');
    }
  };

  const handleAddReference = async () => {
    if (!refName.trim()) return;
    try {
      const entry = await addReference({
        reference_name: refName,
        relationship: refRelationship || null,
        contact_info: refContact || null,
        comment: refComment || null,
      });
      setReferences([entry, ...references]);
      setRefName(''); setRefRelationship(''); setRefContact(''); setRefComment('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add reference');
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      await handleSaveDetails();
      await submitApplication();
      await refreshProfile();
      navigate('/application-status');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit application');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="container" style={{ paddingTop: '4rem' }}>Loading application...</div>;
  }

  return (
    <div className="container animate-fade-in vetting-application" style={{ paddingTop: '3rem', paddingBottom: '4rem', maxWidth: '760px' }}>
      <h2 style={{ textAlign: 'center', color: 'var(--color-olive-dark)' }}>
        {profile?.role === 'coach' ? 'Coach' : 'Tutor'} Application
      </h2>
      <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginBottom: '2rem' }}>
        Tell students about your background so we can review and approve your profile.
      </p>

      {error && (
        <div style={{ backgroundColor: '#ffebee', color: '#c62828', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <div className="glass-card vetting-section">
        <h3>Photo</h3>
        <div className="vetting-photo-row">
          {avatarUrl && <img src={avatarUrl} alt="Profile" className="vetting-photo-preview" />}
          <label className="btn btn-outline">
            {uploadingPhoto ? 'Uploading...' : avatarUrl ? 'Change photo' : 'Upload photo'}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhotoChange} hidden disabled={uploadingPhoto} />
          </label>
        </div>
      </div>

      <div className="glass-card vetting-section">
        <h3>Description of services &amp; specialities</h3>
        <label>About you / your services</label>
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} placeholder="Describe your teaching/coaching style and what you offer..." />

        <label>Qualifications</label>
        <input
          type="text"
          value={qualifications}
          onChange={(e) => setQualifications(e.target.value)}
          placeholder="e.g. BSc Mathematics, PGCE, ICF Certified Coach"
        />

        <label>Specialities</label>
        <div className="vetting-tag-input">
          <input
            type="text"
            value={specialtyDraft}
            onChange={(e) => setSpecialtyDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSpecialty(); } }}
            placeholder="e.g. Mathematics, Case Interviews..."
          />
          <button type="button" className="btn btn-outline btn-sm" onClick={handleAddSpecialty}>Add</button>
        </div>
        <div className="vetting-tag-list">
          {specialties.map((s) => (
            <span key={s} className="vetting-tag">
              {s}
              <button type="button" onClick={() => handleRemoveSpecialty(s)}>&times;</button>
            </span>
          ))}
        </div>

        <div className="vetting-grid-2">
          <div>
            <label>Years of experience</label>
            <input type="number" min={0} value={yearsOfExperience} onChange={(e) => setYearsOfExperience(e.target.value)} />
          </div>
          <div>
            <label>Location</label>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, Country" />
          </div>
          <div>
            <label>Phone number</label>
            <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
          </div>
          <div>
            <label>Preferred contact method</label>
            <input type="text" value={contactPreference} onChange={(e) => setContactPreference(e.target.value)} placeholder="Email, WhatsApp..." />
          </div>
        </div>

        <div className="vetting-checkbox-row">
          <label><input type="checkbox" checked={offersVirtual} onChange={(e) => setOffersVirtual(e.target.checked)} /> Offers virtual sessions</label>
          <label><input type="checkbox" checked={offersInPerson} onChange={(e) => setOffersInPerson(e.target.checked)} /> Offers in-person sessions</label>
        </div>
      </div>

      <div className="glass-card vetting-section">
        <h3>Rate (optional)</h3>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: 0 }}>
          Set an hourly rate and choose whether to show it on your public profile.
        </p>
        <div className="vetting-grid-2">
          <div>
            <label>Amount</label>
            <input type="number" min={0} step="1" value={rateAmount} onChange={(e) => setRateAmount(e.target.value)} placeholder="e.g. 350" />
          </div>
          <div>
            <label>Currency</label>
            <select value={rateCurrency} onChange={(e) => setRateCurrency(e.target.value as 'USD' | 'EUR' | 'ZAR')}>
              <option value="ZAR">ZAR (R)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
            </select>
          </div>
        </div>
        <div className="vetting-checkbox-row">
          <label><input type="checkbox" checked={rateVisible} onChange={(e) => setRateVisible(e.target.checked)} /> Show this rate on my public profile</label>
        </div>
      </div>

      <div className="glass-card vetting-section">
        <h3>Work history</h3>
        {workExperiences.map((we) => (
          <div key={we.id} className="vetting-list-item">
            <div>
              <strong>{we.title}</strong> at {we.company}
              <div className="vetting-list-item-meta">{we.start_date ?? '—'} to {we.end_date ?? 'Present'}</div>
              {we.description && <p>{we.description}</p>}
            </div>
            <button type="button" className="vetting-remove-btn" onClick={async () => {
              await deleteWorkExperience(we.id);
              setWorkExperiences(workExperiences.filter((x) => x.id !== we.id));
            }}>Remove</button>
          </div>
        ))}
        <div className="vetting-grid-2">
          <input type="text" placeholder="Company" value={weCompany} onChange={(e) => setWeCompany(e.target.value)} />
          <input type="text" placeholder="Title" value={weTitle} onChange={(e) => setWeTitle(e.target.value)} />
          <input type="date" placeholder="Start date" value={weStart} onChange={(e) => setWeStart(e.target.value)} />
          <input type="date" placeholder="End date (blank if current)" value={weEnd} onChange={(e) => setWeEnd(e.target.value)} />
        </div>
        <textarea placeholder="Description" rows={2} value={weDescription} onChange={(e) => setWeDescription(e.target.value)} />
        <button type="button" className="btn btn-outline btn-sm" onClick={handleAddWorkExperience}>Add work experience</button>
      </div>

      <div className="glass-card vetting-section">
        <h3>References</h3>
        {references.map((r) => (
          <div key={r.id} className="vetting-list-item">
            <div>
              <strong>{r.reference_name}</strong> {r.relationship && `(${r.relationship})`}
              <div className="vetting-list-item-meta">{r.contact_info}</div>
              {r.comment && <p>{r.comment}</p>}
            </div>
            <button type="button" className="vetting-remove-btn" onClick={async () => {
              await deleteReference(r.id);
              setReferences(references.filter((x) => x.id !== r.id));
            }}>Remove</button>
          </div>
        ))}
        <div className="vetting-grid-2">
          <input type="text" placeholder="Reference name" value={refName} onChange={(e) => setRefName(e.target.value)} />
          <input type="text" placeholder="Relationship (e.g. Former Manager)" value={refRelationship} onChange={(e) => setRefRelationship(e.target.value)} />
          <input type="text" placeholder="Contact info" value={refContact} onChange={(e) => setRefContact(e.target.value)} />
        </div>
        <textarea placeholder="Comment (optional)" rows={2} value={refComment} onChange={(e) => setRefComment(e.target.value)} />
        <button type="button" className="btn btn-outline btn-sm" onClick={handleAddReference}>Add reference</button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '2rem' }}>
        <button className="btn btn-outline" onClick={handleSaveDetails} disabled={saving}>Save draft</button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
          {saving ? 'Submitting...' : 'Submit Application'}
        </button>
      </div>
    </div>
  );
}
