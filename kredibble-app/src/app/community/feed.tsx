import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, TextInput, Modal, Animated, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft, Bell, BellOff, MoreHorizontal, LogOut, Send, X, Link as LinkIcon,
  Plus, Keyboard, Camera, Mic, Image as ImageIcon, BarChart3, ClipboardList, HelpCircle,
} from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, FontWeight } from '../../constants/design';
import { authStore } from '../../constants/authStore';
import { getChannel, getChannelPosts, createChannelPost, uploadFile } from '../../lib/api';
import { pickImage, pickCameraImage } from '../../lib/file-picker';
import { socketService } from '../../lib/socket';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type AttachAction = 'photo' | 'camera' | 'Poll' | 'Quiz' | 'Question';
type InteractiveKind = 'Poll' | 'Quiz' | 'Question';

const ATTACH_ITEMS: { label: string; Icon: any; color: string; action: AttachAction }[] = [
  { label: 'Photo', Icon: ImageIcon, color: '#8B5CF6', action: 'photo' },
  { label: 'Camera', Icon: Camera, color: '#EF4444', action: 'camera' },
  { label: 'Poll', Icon: BarChart3, color: '#10B981', action: 'Poll' },
  { label: 'Quiz', Icon: ClipboardList, color: '#F59E0B', action: 'Quiz' },
  { label: 'Question', Icon: HelpCircle, color: '#3B82F6', action: 'Question' },
];

export default function ChannelFeedScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const channelId = (params.id as string) || '';
  const insets = useSafeAreaInsets();

  const [channel, setChannel] = useState<any | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [notificationsMuted, setNotificationsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Checking ownership just based on company matching for now (since mock had it)
  const isOwner = authStore.role === 'hirer' && channel?.owner === authStore.company?.name;

  const [announceText, setAnnounceText] = useState('');
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  // Interactive Modal State (Poll, Quiz, Question)
  const [interactiveModalOpen, setInteractiveModalOpen] = useState(false);
  const [interactiveKind, setInteractiveKind] = useState<InteractiveKind>('Poll');
  const [interactiveTitle, setInteractiveTitle] = useState('');
  const [interactiveBody, setInteractiveBody] = useState('');
  
  // Custom Toast UI State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<any | null>(null);

  // Custom Dropdown UI State
  const [showDropdown, setShowDropdown] = useState(false);

  // Bottom Sheet Response State
  const [isResponseSheetOpen, setIsResponseSheetOpen] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [activePostId, setActivePostId] = useState<string | null>(null);

  // Animation values
  const [bottomSheetAnim] = useState(() => new Animated.Value(SCREEN_HEIGHT));
  const [backdropAnim] = useState(() => new Animated.Value(0));

  // Fetch from APIs
  useEffect(() => {
    if (!channelId) return;

    const fetchStoreData = async () => {
      setIsLoading(true);
      try {
        const [ch, fetchedPosts] = await Promise.all([
          getChannel(channelId),
          getChannelPosts(channelId)
        ]);
        setChannel(ch);
        setPosts(fetchedPosts);
      } catch (err) {
        console.error('Error fetching channel data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStoreData();
  }, [channelId]);

  // Real-time socket events
  useEffect(() => {
    if (!channelId) return;

    // connect() is async now that it reads the session token from secure store,
    // so the socket does not exist on the next line. `cancelled` keeps a
    // late-resolving connect() from attaching a listener to an unmounted feed.
    let cancelled = false;
    let attached: any = null;

    const onReceive = (newPost: any) => {
      // If the new post was just created by this user, it's already in the feed
      setPosts(prev => {
        if (prev.find(p => p.id === newPost.id)) return prev;
        return [newPost, ...prev];
      });
    };

    socketService
      .connect()
      .then(() => {
        if (cancelled) return;
        const socket = socketService.socket;
        if (!socket) return;
        attached = socket;
        socket.emit('join_channel', channelId);
        socket.on('receive_message', onReceive);
      })
      .catch(() => {
        // Realtime is an enhancement; the feed still renders from fetchStoreData.
      });

    return () => {
      cancelled = true;
      if (attached) {
        attached.off('receive_message', onReceive);
      }
    };
  }, [channelId]);

  // Show Toast helper
  const triggerToast = (message: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(message);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleToggleMute = () => {
    setNotificationsMuted(prev => {
      const next = !prev;
      if (next) {
        triggerToast('Notifications are muted');
      } else {
        triggerToast('Notifications are active');
      }
      return next;
    });
  };

  const handleUnfollow = () => {
    setShowDropdown(false);
    triggerToast('Unfollowed channel');
    setTimeout(() => {
      router.back();
    }, 500);
  };

  const handleToggleReaction = (postId: string, emoji: string) => {
    // API logic for reaction would go here
    triggerToast('Reaction added');
  };

  // Bottom Sheet animation control
  const openBottomSheet = (postId: string) => {
    setActivePostId(postId);
    setIsResponseSheetOpen(true);
    Animated.parallel([
      Animated.timing(backdropAnim, {
        toValue: 0.5,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(bottomSheetAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeBottomSheet = () => {
    Animated.parallel([
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(bottomSheetAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsResponseSheetOpen(false);
      setResponseText('');
      setActivePostId(null);
    });
  };

  const handleSendResponse = () => {
    if (responseText.trim() === '' || !activePostId) return;
    // communityStore.addResponseMessage(activePostId, responseText);
    closeBottomSheet();
    triggerToast('Response shared successfully');
  };

  // ─── Owner compose bar (WhatsApp-style) ──────────────────────────────────────

  const handleSendText = async () => {
    if (!announceText.trim() || isPosting) return;
    setIsPosting(true);
    try {
      const newPost = await createChannelPost(channelId, {
        body: announceText.trim(),
        authorName: authStore.company?.name || 'Hirer',
      });
      setPosts(prev => [newPost, ...prev]);
      setAnnounceText('');
      triggerToast('Posted to channel');
    } catch (err: any) {
      triggerToast(err?.message || 'Failed to post');
    } finally {
      setIsPosting(false);
    }
  };

  const handlePickImage = async (useCamera = false) => {
    setAttachMenuOpen(false);
    try {
      const picked = useCamera
        ? await pickCameraImage({ aspect: [16, 9], quality: 0.85 })
        : await pickImage({ aspect: [16, 9], quality: 0.85 });
      if (!picked) return;
      setIsPosting(true);
      triggerToast('Uploading photo...');
      const uploadRes = await uploadFile(picked, 'company-logos');
      const newPost = await createChannelPost(channelId, {
        body: announceText.trim() || 'Shared a photo',
        authorName: authStore.company?.name || 'Hirer',
        bannerImage: uploadRes.url,
      });
      setPosts(prev => [newPost, ...prev]);
      setAnnounceText('');
      triggerToast('Photo posted');
    } catch (err: any) {
      console.error('Failed to post photo:', err);
      triggerToast(err?.message || 'Failed to post photo');
    } finally {
      setIsPosting(false);
    }
  };

  const handleOpenInteractive = (kind: InteractiveKind) => {
    setAttachMenuOpen(false);
    setInteractiveKind(kind);
    setInteractiveTitle('');
    setInteractiveBody('');
    setInteractiveModalOpen(true);
  };

  const handleCreateInteractivePost = async () => {
    if (!interactiveBody.trim() || isPosting) return;
    const emoji = interactiveKind === 'Poll' ? '📊' : interactiveKind === 'Quiz' ? '📝' : '❓';
    const postTitle = interactiveTitle.trim() || `${emoji} ${interactiveKind}`;
    setIsPosting(true);
    try {
      const newPost = await createChannelPost(channelId, {
        title: postTitle,
        body: interactiveBody.trim(),
        authorName: authStore.company?.name || 'Hirer',
        hasRespondButton: true,
      });
      setPosts(prev => [newPost, ...prev]);
      setInteractiveModalOpen(false);
      setInteractiveTitle('');
      setInteractiveBody('');
      triggerToast(`${interactiveKind} posted`);
    } catch (err: any) {
      console.error(`Failed to post ${interactiveKind}:`, err);
      triggerToast(err?.message || `Failed to post ${interactiveKind}`);
    } finally {
      setIsPosting(false);
    }
  };

  const handleAttach = (action: AttachAction) => {
    if (action === 'photo') {
      handlePickImage(false);
    } else if (action === 'camera') {
      handlePickImage(true);
    } else {
      handleOpenInteractive(action);
    }
  };

  const handleMicPress = () => {
    setAttachMenuOpen(false);
    triggerToast('Voice messages will be supported in an upcoming update');
  };

  if (isLoading || !channel) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgScreen, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginBottom: 12 }} />
        <Text style={{ color: Colors.textMuted }} className="font-sans">Loading channel feed...</Text>
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
          paddingHorizontal: 16,
          paddingVertical: 10,
          zIndex: 10,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            borderWidth: 1,
            borderColor: '#E5E6F2',
            backgroundColor: '#FFFFFF',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 8,
          }}
        >
          <ChevronLeft size={20} color={Colors.textHeading} />
        </TouchableOpacity>

        <Image
          source={{ uri: channel.avatar }}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            marginRight: 10,
            backgroundColor: Colors.bgAlt,
          }}
        />

        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: FontWeight.semibold, color: Colors.textHeading }} className="font-sans">
            {channel.name}
          </Text>
          <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 2 }} className="font-sans">
            {channel.followers}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <TouchableOpacity onPress={handleToggleMute} style={{ padding: 8 }}>
            {notificationsMuted ? (
              <BellOff size={20} color={Colors.textPlaceholder} />
            ) : (
              <Bell size={20} color={Colors.textHeading} />
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowDropdown(prev => !prev)} style={{ padding: 8 }}>
            <MoreHorizontal size={20} color={Colors.textHeading} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Floating Action Menu Dropdown Overlay */}
      {showDropdown && (
        <View
          style={{
            position: 'absolute',
            top: 60,
            right: 16,
            backgroundColor: Colors.white,
            borderRadius: 12,
            paddingVertical: 4,
            minWidth: 160,
            zIndex: 99,
            borderWidth: 1,
            borderColor: Colors.divider,
          }}
        >
          {isOwner ? (
            <TouchableOpacity
              onPress={() => { setShowDropdown(false); triggerToast(`Member management for ${channel.name} is coming soon`); }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingVertical: 12,
              }}
            >
              <Text style={{ fontSize: 13, color: Colors.textHeading, fontWeight: '500' }} className="font-sans">
                View Member List
              </Text>
              <ChevronLeft size={16} color={Colors.textHeading} style={{ transform: [{ rotate: '180deg' }] }} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleUnfollow}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingVertical: 12,
              }}
            >
              <Text style={{ fontSize: 13, color: '#EF4444', fontWeight: '500' }} className="font-sans">
                Unfollow channel
              </Text>
              <LogOut size={16} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Main Feed Content */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Date / System Indicators */}
        <View style={{ alignItems: 'center', marginVertical: 12 }}>
          <View style={{ backgroundColor: Colors.primaryTransparent, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ fontSize: 11, color: Colors.primary, fontWeight: '500' }} className="font-sans">
              9 Feb 2025
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: Colors.primary, marginTop: 10 }} className="font-sans">
            The channel &quot;{channel.name}&quot; was created
          </Text>
        </View>

        {posts.filter(p => p.channelId === channelId && p.id !== 'post-1').map(post => (
          <View key={post.id} style={{ marginBottom: 20 }}>
            {/* Standard Post Card Style */}
            <View
              style={{
                backgroundColor: Colors.white,
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: Colors.divider,
              }}
            >
              {/* Image banner for Scholarship */}
              {post.bannerImage && (
                <View style={{ marginBottom: 12, borderRadius: 12, overflow: 'hidden', height: 160 }}>
                  <Image
                    source={{ uri: post.bannerImage }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                  {post.title?.includes('Scholarship') && (
                    <View style={{
                      position: 'absolute',
                      top: 10,
                      left: 10,
                      backgroundColor: Colors.white,
                      borderRadius: 4,
                      paddingHorizontal: 6,
                      paddingVertical: 4,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4
                    }}>
                      <Text style={{ fontSize: 10, fontWeight: 'bold', color: Colors.primary }}>Bright</Text>
                      <Text style={{ fontSize: 9, color: Colors.textMuted }}>Scholarship</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Title & Body */}
              {post.title && (
                <Text style={{ fontSize: 15, fontWeight: 'bold', color: Colors.primary, marginBottom: 8, textAlign: 'center' }} className="font-sans">
                  {post.title}
                </Text>
              )}

              {!!post.body && (
                <Text style={{ fontSize: 13, color: Colors.textBody, lineHeight: 20 }} className="font-sans">
                  {post.body}
                </Text>
              )}

              {/* Link preview card */}
              {post.link && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: Colors.bgScreen,
                    borderRadius: 8,
                    padding: 10,
                    marginTop: 12,
                  }}
                >
                  <LinkIcon size={14} color={Colors.textMuted} style={{ marginRight: 8 }} />
                  <Text style={{ fontSize: 12, color: Colors.textMuted, textDecorationLine: 'underline' }} className="font-sans">
                    {post.linkText || post.link}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Respond button (only for scholarship in design) */}
              {post.hasRespondButton && (
                <TouchableOpacity
                  onPress={() => openBottomSheet(post.id)}
                  style={{
                    backgroundColor: Colors.white,
                    borderWidth: 1,
                    borderColor: Colors.divider,
                    borderRadius: 10,
                    paddingVertical: 12,
                    alignItems: 'center',
                    marginTop: 16,
                  }}
                >
                  <Text style={{ fontSize: 13, color: Colors.primary, fontWeight: '600' }} className="font-sans">
                    Respond
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Reaction badge row outside of/under the card */}
            {(post.reactions && post.reactions.length > 0) && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, paddingHorizontal: 4 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: Colors.primaryTransparent,
                    borderRadius: 20,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                  }}
                >
                  {post.reactions.map((r: any, i: number) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => handleToggleReaction(post.id, r.emoji)}
                      style={{ marginRight: 4 }}
                    >
                      <Text style={{ fontSize: 12 }}>{r.emoji}</Text>
                    </TouchableOpacity>
                  ))}
                  <Text style={{ fontSize: 11, color: Colors.primary, fontWeight: 'bold', marginLeft: 4 }}>
                    {post.reactions.reduce((sum: number, current: any) => sum + (current.count || 0), 0)}
                  </Text>
                </View>
              </View>
            )}
          </View>
        ))}

        {posts.filter(p => p.channelId === channelId && p.id !== 'post-1').length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <Text style={{ fontSize: 13, color: Colors.textMuted }} className="font-sans">
              {isOwner ? 'No posts yet — share your first update below.' : 'No posts in this channel yet.'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Owner compose bar — WhatsApp-style: attachment menu, text, camera + voice note */}
      {isOwner && (
        <View style={{ backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.divider, paddingBottom: insets.bottom }}>
          {/* Attachment menu */}
          {attachMenuOpen && (
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-around',
                paddingVertical: 16,
                paddingHorizontal: 12,
                borderBottomWidth: 1,
                borderBottomColor: Colors.divider,
              }}
            >
              {ATTACH_ITEMS.map(item => (
                <TouchableOpacity
                  key={item.label}
                  onPress={() => handleAttach(item.action)}
                  style={{ alignItems: 'center', gap: 6, width: 64 }}
                >
                  <View
                    style={{
                      width: 48, height: 48, borderRadius: 24,
                      backgroundColor: item.color,
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <item.Icon size={22} color="#FFFFFF" />
                  </View>
                  <Text style={{ fontSize: 11, color: Colors.textMuted }} className="font-sans">
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Input row */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <TouchableOpacity onPress={() => setAttachMenuOpen(prev => !prev)} style={{ padding: 4 }} disabled={isPosting}>
              {attachMenuOpen ? (
                <Keyboard size={24} color={Colors.textMuted} />
              ) : (
                <Plus size={24} color={Colors.textMuted} />
              )}
            </TouchableOpacity>

            <TextInput
              placeholder={`Post an update to ${channel.name}`}
              placeholderTextColor={Colors.textPlaceholder}
              value={announceText}
              onChangeText={setAnnounceText}
              onFocus={() => setAttachMenuOpen(false)}
              editable={!isPosting}
              style={{
                flex: 1,
                backgroundColor: Colors.bgScreen,
                borderRadius: 24,
                paddingHorizontal: 16,
                height: 44,
                fontSize: 13,
                color: Colors.textBody,
              }}
              className="font-sans"
            />

            {announceText.trim() ? (
              <TouchableOpacity
                onPress={handleSendText}
                disabled={isPosting}
                style={{
                  width: 40, height: 40, borderRadius: 20,
                  backgroundColor: Colors.primary,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                {isPosting ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Send size={16} color={Colors.white} />
                )}
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity onPress={() => handlePickImage(true)} style={{ padding: 4 }} disabled={isPosting}>
                  <Camera size={22} color={Colors.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleMicPress} style={{ padding: 4 }} disabled={isPosting}>
                  <Mic size={22} color={Colors.textMuted} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}

      {/* Blue notifications muted bottom banner Toast */}
      {toastMessage && (
        <View
          style={{
            position: 'absolute',
            bottom: 40,
            alignSelf: 'center',
            backgroundColor: Colors.primary,
            borderRadius: 20,
            paddingVertical: 10,
            paddingHorizontal: 24,
            zIndex: 999,
          }}
        >
          <Text style={{ color: Colors.white, fontSize: 12, fontWeight: '600' }} className="font-sans">
            {toastMessage}
          </Text>
        </View>
      )}

      {/* Response Bottom Sheet Drawer */}
      {isResponseSheetOpen && (
        <Modal transparent visible={isResponseSheetOpen} animationType="none">
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            {/* Dimmed Background Overlay */}
            <TouchableOpacity
              activeOpacity={1}
              onPress={closeBottomSheet}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.4)',
              }}
            />

            {/* Keyboard-accessory area & Response Container */}
            <Animated.View
              style={{
                backgroundColor: Colors.white,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                paddingBottom: 24,
                transform: [{ translateY: bottomSheetAnim }],
              }}
            >
              {/* Emoji quick reaction bar floating directly above input block */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'center',
                  backgroundColor: Colors.primaryTransparent,
                  paddingVertical: 10,
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                  gap: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: Colors.divider,
                }}
              >
                {['😂', '😭', '😢', '😂', '😆', '❤️'].map((emoji, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => {
                      if (activePostId) {
                        handleToggleReaction(activePostId, emoji);
                        triggerToast('Reaction updated');
                      }
                    }}
                    style={{ padding: 4 }}
                  >
                    <Text style={{ fontSize: 20 }}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Close Button & Tips Banner */}
              <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 }}>
                  <TouchableOpacity
                    onPress={closeBottomSheet}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: Colors.bgScreen,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <X size={16} color={Colors.textHeading} />
                  </TouchableOpacity>
                </View>

                {/* Admins can share response tips banner */}
                <View
                  style={{
                    backgroundColor: Colors.primaryTransparent,
                    borderRadius: 10,
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16,
                  }}
                >
                  <Text style={{ fontSize: 11, color: Colors.primary, fontWeight: '500', textAlign: 'center' }} className="font-sans">
                    💡 Admins can share your response in the channel
                  </Text>
                </View>

                {/* Text input row */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <TextInput
                    placeholder="Respond to Breaking into Tech Successfully"
                    placeholderTextColor={Colors.textPlaceholder}
                    value={responseText}
                    onChangeText={setResponseText}
                    autoFocus
                    style={{
                      flex: 1,
                      backgroundColor: Colors.bgScreen,
                      borderRadius: 24,
                      paddingHorizontal: 16,
                      height: 48,
                      fontSize: 13,
                      color: Colors.textBody,
                    }}
                    className="font-sans"
                  />

                  {/* Send Button */}
                  <TouchableOpacity
                    onPress={handleSendResponse}
                    disabled={responseText.trim() === ''}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: responseText.trim() !== '' ? Colors.primary : '#E5E7EB',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Send size={16} color={responseText.trim() !== '' ? Colors.white : Colors.textPlaceholder} />
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          </View>
        </Modal>
      )}

      {/* Interactive Post Modal (Poll, Quiz, Question) */}
      <Modal
        visible={interactiveModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setInteractiveModalOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 420,
              backgroundColor: Colors.white,
              borderRadius: 20,
              padding: 20,
            }}
          >
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor:
                      interactiveKind === 'Poll' ? '#ECFDF5' : interactiveKind === 'Quiz' ? '#FEF3C7' : '#EFF6FF',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {interactiveKind === 'Poll' && <BarChart3 size={20} color="#10B981" />}
                  {interactiveKind === 'Quiz' && <ClipboardList size={20} color="#F59E0B" />}
                  {interactiveKind === 'Question' && <HelpCircle size={20} color="#3B82F6" />}
                </View>
                <Text style={{ fontSize: 17, fontWeight: '700', color: Colors.textHeading }} className="font-sans">
                  Create {interactiveKind}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setInteractiveModalOpen(false)}
                disabled={isPosting}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: Colors.bgScreen,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Optional Title / Topic */}
            <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.textMuted, marginBottom: 6 }} className="font-sans">
              Topic or Headline (optional)
            </Text>
            <TextInput
              placeholder={`e.g. Weekly ${interactiveKind}`}
              placeholderTextColor={Colors.textPlaceholder}
              value={interactiveTitle}
              onChangeText={setInteractiveTitle}
              editable={!isPosting}
              style={{
                backgroundColor: Colors.bgScreen,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 10,
                fontSize: 14,
                color: Colors.textHeading,
                marginBottom: 14,
              }}
              className="font-sans"
            />

            {/* Body / Content */}
            <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.textMuted, marginBottom: 6 }} className="font-sans">
              {interactiveKind === 'Poll'
                ? 'Poll Question & Options'
                : interactiveKind === 'Quiz'
                ? 'Quiz Prompt & Choices'
                : 'Question Details'}
            </Text>
            <TextInput
              placeholder={
                interactiveKind === 'Poll'
                  ? 'Ask a question and list options for members to respond...'
                  : interactiveKind === 'Quiz'
                  ? 'Enter the question, scenarios, and choices...'
                  : 'Ask a question for channel members to discuss...'
              }
              placeholderTextColor={Colors.textPlaceholder}
              value={interactiveBody}
              onChangeText={setInteractiveBody}
              multiline
              numberOfLines={4}
              editable={!isPosting}
              textAlignVertical="top"
              style={{
                backgroundColor: Colors.bgScreen,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 14,
                color: Colors.textHeading,
                minHeight: 100,
                marginBottom: 20,
              }}
              className="font-sans"
            />

            {/* Actions */}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setInteractiveModalOpen(false)}
                disabled={isPosting}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 10,
                  backgroundColor: Colors.bgScreen,
                }}
              >
                <Text style={{ fontSize: 14, color: Colors.textMuted, fontWeight: '600' }} className="font-sans">
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleCreateInteractivePost}
                disabled={!interactiveBody.trim() || isPosting}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingVertical: 10,
                  paddingHorizontal: 20,
                  borderRadius: 10,
                  backgroundColor: interactiveBody.trim() && !isPosting ? Colors.primary : '#E5E7EB',
                }}
              >
                {isPosting && <ActivityIndicator size="small" color={Colors.white} />}
                <Text
                  style={{
                    fontSize: 14,
                    color: interactiveBody.trim() && !isPosting ? Colors.white : Colors.textPlaceholder,
                    fontWeight: '700',
                  }}
                  className="font-sans"
                >
                  {isPosting ? 'Posting...' : 'Post'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
