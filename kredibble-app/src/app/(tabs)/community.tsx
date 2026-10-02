import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, X, Plus, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Colors, FontSize, FontWeight, Radius, Shadow } from '../../constants/design';
import { authStore, ManagedGroup } from '../../constants/authStore';
import { getChannels, createChannel } from '../../lib/api';

// ─── Logo ─────────────────────────────────────────────────────────────────────
const LogoSVG = () => (
  <Image
    source={require('../../../assets/images/logo.png')}
    style={{ width: 40, height: 40, borderRadius: 20 }}
    resizeMode="contain"
  />
);

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function CommunityScreen() {
  const router = useRouter();
  const [role, setRole] = useState(authStore.role);
  
  // Seeker states
  const [channels, setChannels] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Hirer states
  const [hirerTab, setHirerTab] = useState<'discover' | 'managed'>('managed');
  
  // Create Channel Modal state
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelCategory, setNewChannelCategory] = useState('');
  const [newChannelBio, setNewChannelBio] = useState('');

  // Subscribe to auth store updates & fetch initial data
  useEffect(() => {
    // Fetch channels from backend; isLoading starts true.
    getChannels()
      .then(setChannels)
      .catch((e) => console.error('Failed to fetch channels:', e))
      .finally(() => setIsLoading(false));

    // State is initialised from authStore; the subscription keeps it in sync.
    const unsubAuth = authStore.subscribe(() => {
      setRole(authStore.role);
    });

    return () => {
      unsubAuth();
    };
  }, []);

  const handleFollow = (id: string) => {
    // Optimistic UI update or integrate API
    alert(`Followed channel ${id}`);
  };

  const handleDismiss = (id: string) => {
    // Local filter out
    setChannels(prev => prev.filter(c => c.id !== id));
  };

  const handleCreateChannel = async () => {
    if (!newChannelName || !newChannelCategory || !newChannelBio) {
      alert('Please fill out all fields.');
      return;
    }
    
    const avatars = [
      'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=120&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=120&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=120&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1561070791-26c113006238?w=120&auto=format&fit=crop&q=80'
    ];
    const chosenAvatar = avatars[Math.floor(Math.random() * avatars.length)];

    try {
      const newChannel = await createChannel({
        name: newChannelName,
        category: newChannelCategory,
        bio: newChannelBio,
        avatar: chosenAvatar,
        followers: '1 member',
        owner: authStore.company?.name || 'Public'
      });

      setChannels([newChannel, ...channels]);
      
      setNewChannelName('');
      setNewChannelCategory('');
      setNewChannelBio('');
      setCreateModalVisible(false);

      alert(`Success: Community Channel "${newChannelName}" created successfully!`);
    } catch (e) {
      alert('Failed to create channel.');
    }
  };

  // Filter channels for Seeker & Hirer Discovery
  const filteredChannels = channels.filter(channel =>
    channel.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const followedChannels = filteredChannels.filter(c => c.followed);
  const recommendedChannels = filteredChannels.filter(c => !c.followed);
  
  // For Hirer managed tab, we just show channels they own (mocked as owner matching company name)
  const managedGroups = channels.filter(c => c.owner === authStore.company?.name || c.id.startsWith('group-'));

  if (role === 'hirer') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F7F9' }} edges={['top', 'left', 'right']}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
          <LogoSVG />
          <Text style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: '#1A1A1A', marginRight: 40 }} className="font-sans">
            Community Groups
          </Text>
        </View>

        {/* Tab Selection */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 20, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#E5E6F2' }}>
          <TouchableOpacity
            onPress={() => setHirerTab('managed')}
            style={{ paddingVertical: 12, marginRight: 24, borderBottomWidth: 2, borderBottomColor: hirerTab === 'managed' ? '#6671E4' : 'transparent' }}
          >
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: hirerTab === 'managed' ? '#6671E4' : '#8A8D9F' }} className="font-sans">Managed by Me</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setHirerTab('discover')}
            style={{ paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: hirerTab === 'discover' ? '#6671E4' : 'transparent' }}
          >
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: hirerTab === 'discover' ? '#6671E4' : '#8A8D9F' }} className="font-sans">Discover All</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          {isLoading && <ActivityIndicator size="small" color="#6671E4" style={{ marginTop: 20, marginBottom: 20 }} />}
          {hirerTab === 'managed' ? (
            <View>
              {/* Quick Action: Create a Group */}
              <TouchableOpacity
                onPress={() => setCreateModalVisible(true)}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: '#6671E4', borderRadius: 12,
                  paddingVertical: 14, gap: 8, marginBottom: 20,
                  shadowColor: '#6671E4', shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15, shadowRadius: 10, elevation: 3,
                }}
              >
                <Plus size={18} color="#FFFFFF" strokeWidth={3} />
                <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' }} className="font-sans">Create a Channel</Text>
              </TouchableOpacity>

              {/* Managed Groups List */}
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#8A8D9F', marginBottom: 12 }} className="font-sans">ACTIVE CHANNELS ({managedGroups.length})</Text>
              
              <View style={{ gap: 16 }}>
                {managedGroups.map(group => (
                  <TouchableOpacity
                    key={group.id}
                    onPress={() => router.push({ pathname: '/community/feed', params: { id: group.id } })}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      backgroundColor: '#FFFFFF', borderRadius: 16,
                      padding: 16, borderWidth: 1, borderColor: '#E5E6F2',
                    }}
                  >
                    <Image source={{ uri: group.avatar || 'https://via.placeholder.com/50' }} style={{ width: 50, height: 50, borderRadius: 25, marginRight: 12 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1A1A1A' }} className="font-sans">{group.name}</Text>
                      <Text style={{ fontSize: 12, color: '#8A8D9F', marginTop: 2 }} className="font-sans">{group.category} • {group.followers || group.members || '1 member'}</Text>
                    </View>
                    <ChevronRight size={18} color="#A1A1AA" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <View>
              {/* Discover/Search All Channels */}
              <View
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  backgroundColor: '#FFFFFF', borderRadius: 15,
                  paddingHorizontal: 16, height: 50,
                  marginBottom: 16,
                  shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
                }}
              >
                <Search size={18} color="#A1A1AA" style={{ marginRight: 10 }} />
                <TextInput
                  placeholder="Search channels..."
                  placeholderTextColor="#A1A1AA"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  style={{ flex: 1, fontSize: 14, color: '#1A1A1A', outline: 'none' } as any}
                  className="font-sans"
                />
              </View>

              {/* Channels this Hirer has joined — accessible above ALL COMMUNITIES */}
              {followedChannels.length > 0 && (
                <View style={{ marginBottom: 24 }}>
                  <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#8A8D9F', marginBottom: 12 }} className="font-sans">YOUR CHANNELS</Text>
                  <View style={{ gap: 16 }}>
                    {followedChannels.map(channel => (
                      <TouchableOpacity
                        key={channel.id}
                        onPress={() => router.push({ pathname: '/community/feed', params: { id: channel.id } })}
                        style={{
                          flexDirection: 'row', alignItems: 'center',
                          backgroundColor: '#FFFFFF', borderRadius: 16,
                          padding: 16, borderWidth: 1, borderColor: '#E5E6F2',
                        }}
                      >
                        <Image source={{ uri: channel.avatar || 'https://via.placeholder.com/50' }} style={{ width: 44, height: 44, borderRadius: 22, marginRight: 12 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1A1A1A' }} className="font-sans">{channel.name}</Text>
                          <Text style={{ fontSize: 12, color: '#8A8D9F', marginTop: 2 }} className="font-sans">{channel.followers || '850 members'}</Text>
                        </View>
                        <ChevronRight size={18} color="#A1A1AA" />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#8A8D9F', marginBottom: 12 }} className="font-sans">ALL COMMUNITIES</Text>

              <View style={{ gap: 16 }}>
                {recommendedChannels.map(channel => (
                  <View
                    key={channel.id}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      backgroundColor: '#FFFFFF', borderRadius: 16,
                      padding: 16, borderWidth: 1, borderColor: '#E5E6F2',
                    }}
                  >
                    <Image source={{ uri: channel.avatar || 'https://via.placeholder.com/50' }} style={{ width: 44, height: 44, borderRadius: 22, marginRight: 12 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1A1A1A' }} className="font-sans">{channel.name}</Text>
                      <Text style={{ fontSize: 12, color: '#8A8D9F', marginTop: 2 }} className="font-sans">{channel.followers || '850 members'}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleFollow(channel.id)}
                      style={{
                        backgroundColor: '#EEF2FF',
                        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
                      }}
                    >
                      <Text style={{ fontSize: 11, color: '#6671E4', fontWeight: 'bold' }} className="font-sans">
                        Join
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* ─── CREATE CHANNEL MODAL ────────────────────────────────────── */}
        <Modal visible={createModalVisible} animationType="slide" transparent>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' }}>
              
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1A1A1A' }} className="font-sans">Create a Channel</Text>
                <TouchableOpacity onPress={() => setCreateModalVisible(false)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' }}>
                  <X size={16} color="#1A1A1A" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#4A4D5F', marginBottom: 6 }} className="font-sans">Channel Name</Text>
                  <TextInput
                    placeholder="e.g. Google Tech Circle"
                    placeholderTextColor="#A1A1AA"
                    value={newChannelName}
                    onChangeText={setNewChannelName}
                    style={{ height: 48, borderWidth: 1, borderColor: '#E5E6F2', borderRadius: 8, paddingHorizontal: 12, fontSize: 14, color: '#1A1A1A', outline: 'none' } as any}
                    className="font-sans"
                  />
                </View>

                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#4A4D5F', marginBottom: 6 }} className="font-sans">Category</Text>
                  <TextInput
                    placeholder="e.g. Coding & Technology"
                    placeholderTextColor="#A1A1AA"
                    value={newChannelCategory}
                    onChangeText={setNewChannelCategory}
                    style={{ height: 48, borderWidth: 1, borderColor: '#E5E6F2', borderRadius: 8, paddingHorizontal: 12, fontSize: 14, color: '#1A1A1A', outline: 'none' } as any}
                    className="font-sans"
                  />
                </View>

                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#4A4D5F', marginBottom: 6 }} className="font-sans">Description / About Group</Text>
                  <TextInput
                    placeholder="Provide a description so prospective members know what to expect..."
                    placeholderTextColor="#A1A1AA"
                    value={newChannelBio}
                    onChangeText={setNewChannelBio}
                    multiline
                    numberOfLines={4}
                    style={{ height: 100, borderWidth: 1, borderColor: '#E5E6F2', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1A1A1A', textAlignVertical: 'top', outline: 'none' } as any}
                    className="font-sans"
                  />
                </View>

                <TouchableOpacity
                  onPress={handleCreateChannel}
                  style={{
                    backgroundColor: '#6671E4', borderRadius: 8, height: 48,
                    justifyContent: 'center', alignItems: 'center', marginTop: 12,
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' }} className="font-sans">Launch Channel</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgScreen }} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 12,
        }}
      >
        <LogoSVG />
        <Text
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: FontSize.screenTitle,
            fontWeight: FontWeight.semibold,
            color: Colors.textHeading,
            marginRight: 40,
          }}
          className="font-sans"
        >
          Community
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading && <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 20, marginBottom: 20 }} />}
        
        {/* Search Bar */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: Colors.white,
            borderRadius: Radius.searchBar,
            paddingHorizontal: 16,
            height: 50,
            marginBottom: 20,
            ...Shadow.searchBar,
          }}
        >
          <Search size={18} color={Colors.textPlaceholder} style={{ marginRight: 10 }} />
          <TextInput
            placeholder="Search"
            placeholderTextColor={Colors.textPlaceholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{
              flex: 1,
              fontSize: 13,
              color: Colors.textBody,
              height: '100%',
              paddingVertical: 0,
            }}
            className="font-sans"
          />
        </View>

        {/* Followed Channels List */}
        <View style={{ marginBottom: 24 }}>
          {followedChannels.map(channel => (
            <TouchableOpacity
              key={channel.id}
              activeOpacity={0.8}
              onPress={() => router.push({
                pathname: '/community/feed',
                params: { id: channel.id }
              })}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: Colors.transparent,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: Colors.divider,
              }}
            >
              <Image
                source={{ uri: channel.avatar || 'https://via.placeholder.com/50' }}
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  marginRight: 12,
                  backgroundColor: Colors.bgAlt
                }}
              />
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: FontWeight.semibold, color: Colors.textHeading }} className="font-sans">
                  {channel.name}
                </Text>
                {channel.lastMessage && (
                  <Text numberOfLines={2} style={{ fontSize: 12, color: Colors.textMuted, marginTop: 4, lineHeight: 16 }} className="font-sans">
                    {channel.lastMessage}
                  </Text>
                )}
              </View>
              <View style={{ alignItems: 'flex-end', justifyContent: 'center', gap: 6 }}>
                {channel.time && (
                  <Text style={{ fontSize: 11, color: Colors.textPlaceholder }} className="font-sans">
                    {channel.time}
                  </Text>
                )}
                {channel.unreadCount && channel.unreadCount > 0 ? (
                  <View style={{
                    backgroundColor: Colors.primary,
                    borderRadius: 12,
                    minWidth: 20,
                    height: 20,
                    justifyContent: 'center',
                    alignItems: 'center',
                    paddingHorizontal: 4,
                  }}>
                    <Text style={{ color: Colors.white, fontSize: 10, fontWeight: 'bold' }}>
                      {channel.unreadCount}
                    </Text>
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Find Channels to Follow Header */}
        <Text style={{ fontSize: 12, fontWeight: FontWeight.medium, color: Colors.textMuted, opacity: 0.6, marginBottom: 16 }} className="font-sans">
          Find channels to follow
        </Text>

        {/* Recommendations List */}
        {recommendedChannels.length > 0 ? (
          recommendedChannels.map(channel => (
            <View
              key={channel.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: Colors.transparent,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: Colors.divider,
              }}
            >
              <Image
                source={{ uri: channel.avatar || 'https://via.placeholder.com/50' }}
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  marginRight: 12,
                  backgroundColor: Colors.bgAlt
                }}
              />
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: FontWeight.semibold, color: Colors.textHeading }} className="font-sans">
                  {channel.name}
                </Text>
                <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 4 }} className="font-sans">
                  {channel.followers}
                </Text>
              </View>
              
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TouchableOpacity
                  onPress={() => handleFollow(channel.id)}
                  style={{
                    backgroundColor: '#EEF2FF',
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ fontSize: 12, color: Colors.primary, fontWeight: '600' }} className="font-sans">
                    Follow
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleDismiss(channel.id)}
                  style={{ padding: 4 }}
                >
                  <X size={16} color={Colors.textPlaceholder} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <View style={{ paddingVertical: 20, alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: Colors.textMuted }} className="font-sans">
              No recommended channels available.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
