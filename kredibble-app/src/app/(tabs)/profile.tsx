import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, Modal, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Settings, Bookmark, Target, Bell, Shield, LogOut, ChevronRight, Check } from 'lucide-react-native';
import { profileStore } from '../../constants/mockProfile';
import { authStore } from '../../constants/authStore';
import { getMe } from '../../lib/api';
import { AmbassadorCta } from '../../components/ui/AmbassadorCta';

// Reuse LogoSVG from index
const LogoSVG = () => (
  <Image
    source={require('../../../assets/images/logo.png')}
    style={{ width: 40, height: 40, borderRadius: 20 }}
    resizeMode="contain"
  />
);

export default function ProfileScreen() {
  const router = useRouter();
  
  // Seeker profile states from authStore
  const [authUser, setAuthUser] = useState(authStore.user);
  const [logoutVisible, setLogoutVisible] = useState(false);

  // Hirer global auth store states
  const [role, setRole] = useState(authStore.role);
  const [company, setCompany] = useState(authStore.company);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const userData = await getMe();
        authStore.setSession(authStore.token!, userData);
      } catch (err) {
        console.error('Failed to refresh profile:', err);
      }
    };

    if (authStore.token) {
      fetchProfile();
    }

    // State is initialised from authStore; the subscription keeps it in sync.
    const unsubscribe = authStore.subscribe(() => {
      setRole(authStore.role);
      setCompany(authStore.company ? { ...authStore.company } : null);
      setAuthUser(authStore.user);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleLogout = () => {
    setLogoutVisible(false);
    authStore.clearSession();
    profileStore.logout();
    router.replace('/(auth)/login');
  };

  if (role === 'hirer') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        {/* Header */}
        <View style={styles.header}>
          <LogoSVG />
          <Text style={styles.headerTitle} className="font-sans">Recruiter Space</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Banner & Logo */}
          {company ? (
            <View style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: '#FFFFFF', marginBottom: 24, borderWidth: 1, borderColor: '#E5E6F2' }}>
              <Image source={{ uri: company.bannerImage || 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800' }} style={{ height: 100, width: '100%' }} />
              
              <View style={{ padding: 16, alignItems: 'center', marginTop: -40 }}>
                <Image source={{ uri: company.logo || 'https://via.placeholder.com/150' }} style={{ width: 80, height: 80, borderRadius: 20, borderWidth: 3, borderColor: '#FFFFFF', backgroundColor: '#FFFFFF' }} />

                {company.verified && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#DCFCE7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginTop: 8 }}>
                    <Check size={12} color="#16A34A" strokeWidth={3} style={{ marginRight: 4 }} />
                    <Text style={{ fontSize: 10, color: '#16A34A', fontWeight: 'bold' }} className="font-sans">Verified Enterprise</Text>
                  </View>
                )}

                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1A1A1A', marginTop: 8 }} className="font-sans">{company.recruiterName}</Text>
                <Text style={{ fontSize: 12, color: '#8A8D9F', marginTop: 2 }} className="font-sans">{company.recruiterRole} • {company.name}</Text>
              </View>
            </View>
          ) : (
            <View style={{ height: 200, justifyContent: 'center', alignItems: 'center' }}>
              <Text className="font-sans text-[#8A8D9F]">Loading profile...</Text>
            </View>
          )}

          <AmbassadorCta />

          {/* Quick Info Menu Card */}
          <View style={styles.menuCard}>
            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.7}
              onPress={() => router.push('/hirer-profile/company')}
            >
              <View style={styles.menuItemLeft}>
                <Settings size={20} color="#8A8D9F" style={{ marginRight: 12 }} />
                <Text style={styles.menuText} className="font-sans">Company Profile</Text>
              </View>
              <ChevronRight size={18} color="#8A8D9F" />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.7}
              onPress={() => router.push('/hirer-profile/recruiter')}
            >
              <View style={styles.menuItemLeft}>
                <Settings size={20} color="#8A8D9F" style={{ marginRight: 12 }} />
                <Text style={styles.menuText} className="font-sans">Recruiter Details</Text>
              </View>
              <ChevronRight size={18} color="#8A8D9F" />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.7}
              onPress={() => router.push('/hirer-profile/verification')}
            >
              <View style={styles.menuItemLeft}>
                <Shield size={20} color="#8A8D9F" style={{ marginRight: 12 }} />
                <Text style={styles.menuText} className="font-sans">Verification Center</Text>
              </View>
              <ChevronRight size={18} color="#8A8D9F" />
            </TouchableOpacity>
          </View>

          {/* Activity Menu Card */}
          <View style={styles.menuCard}>
            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.7}
              onPress={() => router.push('/hirer-profile/postings')}
            >
              <View style={styles.menuItemLeft}>
                <Bookmark size={20} color="#8A8D9F" style={{ marginRight: 12 }} />
                <Text style={styles.menuText} className="font-sans">My Postings</Text>
              </View>
              <ChevronRight size={18} color="#8A8D9F" />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.7}
              onPress={() => router.push('/hirer-profile/channels')}
            >
              <View style={styles.menuItemLeft}>
                <Target size={20} color="#8A8D9F" style={{ marginRight: 12 }} />
                <Text style={styles.menuText} className="font-sans">My Channels</Text>
              </View>
              <ChevronRight size={18} color="#8A8D9F" />
            </TouchableOpacity>
          </View>

          {/* Settings Menu Card */}
          <View style={styles.menuCard}>
            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.7}
              onPress={() => router.push('/hirer-profile/notifications')}
            >
              <View style={styles.menuItemLeft}>
                <Bell size={20} color="#8A8D9F" style={{ marginRight: 12 }} />
                <Text style={styles.menuText} className="font-sans">Manage notifications</Text>
              </View>
              <ChevronRight size={18} color="#8A8D9F" />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.7}
              onPress={() => router.push('/hirer-profile/security')}
            >
              <View style={styles.menuItemLeft}>
                <Shield size={20} color="#8A8D9F" style={{ marginRight: 12 }} />
                <Text style={styles.menuText} className="font-sans">Manage security</Text>
              </View>
              <ChevronRight size={18} color="#8A8D9F" />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.7}
              onPress={() => setLogoutVisible(true)}
            >
              <View style={styles.menuItemLeft}>
                <LogOut size={20} color="#ED4C5C" style={{ marginRight: 12 }} />
                <Text style={[styles.menuText, { color: '#ED4C5C' }]} className="font-sans">Log Out</Text>
              </View>
              <ChevronRight size={18} color="#ED4C5C" />
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Logout Dialog Modal */}
        <Modal
          visible={logoutVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setLogoutVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle} className="font-sans">Log out of account?</Text>
              <Text style={styles.modalSubtitle} className="font-sans">Are you sure you want to log out of your account?</Text>
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={styles.cancelButton} 
                  onPress={() => setLogoutVisible(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cancelButtonText} className="font-sans">Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.logoutConfirmButton} 
                  onPress={handleLogout}
                  activeOpacity={0.8}
                >
                  <Text style={styles.logoutButtonText} className="font-sans">Log out</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <LogoSVG />
        <Text style={styles.headerTitle} className="font-sans">Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* User Card */}
        <View style={styles.userContainer}>
          <Image source={{ uri: (authUser as any)?.avatarUrl || 'https://via.placeholder.com/150' }} style={styles.avatar} />
          
          {(authUser?.seeker as any)?.verified && (
            <View style={styles.verifiedBadge}>
              <Check size={12} color="#16A34A" strokeWidth={3} style={{ marginRight: 4 }} />
              <Text style={styles.verifiedText} className="font-sans">Verified</Text>
            </View>
          )}

          <Text style={styles.userName} className="font-sans">{authUser?.name || 'User'}</Text>
          <Text style={styles.userProfession} className="font-sans">{(authUser?.seeker as any)?.profession || 'Opportunity Seeker'}</Text>
        </View>

        <AmbassadorCta />

        {/* Menu Card 1 */}
        <View style={styles.menuCard}>
          <TouchableOpacity 
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => router.push('/profile/manage')}
          >
            <View style={styles.menuItemLeft}>
              <Settings size={20} color="#8A8D9F" style={{ marginRight: 12 }} />
              <Text style={styles.menuText} className="font-sans">Manage profile</Text>
            </View>
            <ChevronRight size={18} color="#8A8D9F" />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity 
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => router.push('/profile/saved')}
          >
            <View style={styles.menuItemLeft}>
              <Bookmark size={20} color="#8A8D9F" style={{ marginRight: 12 }} />
              <Text style={styles.menuText} className="font-sans">Saved opportunities</Text>
            </View>
            <ChevronRight size={18} color="#8A8D9F" />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity 
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => router.push('/profile/applications')}
          >
            <View style={styles.menuItemLeft}>
              <Target size={20} color="#8A8D9F" style={{ marginRight: 12 }} />
              <Text style={styles.menuText} className="font-sans">Applications Status</Text>
            </View>
            <ChevronRight size={18} color="#8A8D9F" />
          </TouchableOpacity>
        </View>

        {/* Menu Card 2 */}
        <View style={styles.menuCard}>
          <TouchableOpacity 
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => router.push('/profile/notifications')}
          >
            <View style={styles.menuItemLeft}>
              <Bell size={20} color="#8A8D9F" style={{ marginRight: 12 }} />
              <Text style={styles.menuText} className="font-sans">Manage notifications</Text>
            </View>
            <ChevronRight size={18} color="#8A8D9F" />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity 
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => router.push('/profile/security')}
          >
            <View style={styles.menuItemLeft}>
              <Shield size={20} color="#8A8D9F" style={{ marginRight: 12 }} />
              <Text style={styles.menuText} className="font-sans">Manage security</Text>
            </View>
            <ChevronRight size={18} color="#8A8D9F" />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity 
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => setLogoutVisible(true)}
          >
            <View style={styles.menuItemLeft}>
              <LogOut size={20} color="#ED4C5C" style={{ marginRight: 12 }} />
              <Text style={[styles.menuText, { color: '#ED4C5C' }]} className="font-sans">Log Out</Text>
            </View>
            <ChevronRight size={18} color="#ED4C5C" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Logout Dialog Modal */}
      <Modal
        visible={logoutVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setLogoutVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle} className="font-sans">Log out of account?</Text>
            <Text style={styles.modalSubtitle} className="font-sans">Are you sure you want to log out of your account?</Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={() => setLogoutVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelButtonText} className="font-sans">Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.logoutConfirmButton} 
                onPress={handleLogout}
                activeOpacity={0.8}
              >
                <Text style={styles.logoutButtonText} className="font-sans">Log out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  userContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 24,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 24,
    backgroundColor: '#EBEBEE',
    marginBottom: 12,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 8,
  },
  verifiedText: {
    fontSize: 10,
    color: '#16A34A',
    fontWeight: '600',
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  userProfession: {
    fontSize: 13,
    color: '#8A8D9F',
    fontWeight: '400',
  },
  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 8,
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  divider: {
    height: 1,
    backgroundColor: '#EBEBEE',
    marginHorizontal: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#8A8D9F',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    height: 48,
    backgroundColor: '#F3F3F3',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  logoutConfirmButton: {
    flex: 1,
    height: 48,
    backgroundColor: '#ED4C5C',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
