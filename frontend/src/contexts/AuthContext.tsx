import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import type { Profile, ProviderDetails } from '../types/lms';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  providerDetails: ProviderDetails | null;
  loading: boolean;
  isParentMode: boolean;
  toggleParentMode: () => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [providerDetails, setProviderDetails] = useState<ProviderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [isParentMode, setIsParentMode] = useState(false);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.warn('Could not fetch profile:', error.message);
      return null;
    }
    return data as Profile;
  }, []);

  const fetchProviderDetails = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('provider_details')
      .select('*')
      .eq('profile_id', userId)
      .maybeSingle();

    if (error) {
      console.warn('Could not fetch provider details:', error.message);
      return null;
    }
    return data as ProviderDetails | null;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      const p = await fetchProfile(user.id);
      setProfile(p);
      if (p && (p.role === 'tutor' || p.role === 'coach')) {
        setProviderDetails(await fetchProviderDetails(user.id));
      } else {
        setProviderDetails(null);
      }
    }
  }, [user, fetchProfile, fetchProviderDetails]);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        const p = await fetchProfile(session.user.id);
        setProfile(p);
        if (p && (p.role === 'tutor' || p.role === 'coach')) {
          setProviderDetails(await fetchProviderDetails(session.user.id));
        }
      }

      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        const p = await fetchProfile(session.user.id);
        setProfile(p);
        if (p && (p.role === 'tutor' || p.role === 'coach')) {
          setProviderDetails(await fetchProviderDetails(session.user.id));
        } else {
          setProviderDetails(null);
        }
      } else {
        setProfile(null);
        setProviderDetails(null);
        setIsParentMode(false);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile, fetchProviderDetails]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setProviderDetails(null);
    setIsParentMode(false);
  };

  const toggleParentMode = () => {
    setIsParentMode(prev => !prev);
  };

  return (
    <AuthContext.Provider value={{
      session,
      user,
      profile,
      providerDetails,
      loading,
      isParentMode,
      toggleParentMode,
      signOut,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
