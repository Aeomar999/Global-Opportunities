import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, TextInput, Modal, Animated, Dimensions, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft, Bell, BellOff, MoreHorizontal, LogOut, Send, X, Link as LinkIcon,
  Plus, Keyboard, Camera, Mic, Image as ImageIcon, BarChart3, ClipboardList, HelpCircle, Trash2,
} from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, FontSize, FontWeight, Radius } from '../../constants/design';
import { authStore } from '../../constants/authStore';
import { getChannel, getChannelPosts, createChannelPost } from '../../lib/api';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type AttachAction = 'image' | 'Poll' | 'Quiz' | 'Question';

// Plain data: handlers are dispatched from the press callback, so render never
// holds functions that touch the toast/recording refs.
const ATTACH_ITEMS: { label: string; Icon: any; color: string; action: AttachAction }[] = [
  { label: 'Photo', Icon: ImageIcon, color: '#8B5CF6', action: 'image' },
  { label: 'Camera', Icon: Camera, color: '#EF4444', action: 'image' },
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
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordIntervalRef = useRef<any>(null);
  
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
    const { socketService } = require('../../lib/socket');

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
    if (!announceText.trim()) return;
    try {
      const newPost = await createChannelPost(channelId, {
        body: announceText.trim(),
        authorName: authStore.company?.name || 'Hirer',
      });
      setPosts([newPost, ...posts]);
      setAnnounceText('');
      triggerToast('Posted to channel');
    } catch (err) {
      alert('Failed to post');
    }
  };

  const pickImageAndPost = () => {
    setAttachMenuOpen(false);
    if (Platform.OS !== 'web') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    (input as any).onchange = async (e: any) => {
      const file = e.target?.files?.[0];
      if (file) {
        const url = URL.createObjectURL(file); // Mock upload for UI preview
        try {
          const newPost = await createChannelPost(channelId, {
            body: 'Posted an image',
            authorName: authStore.company?.name || 'Hirer',
            bannerImage: url
          });
          setPosts([newPost, ...posts]);
          triggerToast('Photo posted');
        } catch(err) {
          alert('Failed to post photo');
        }
      }
    };
    input.click();
  };

  const promptAndPost = async (kind: 'Poll' | 'Quiz' | 'Question') => {
    setAttachMenuOpen(false);
    if (Platform.OS !== 'web') return;
    const text = window.prompt(`Write your ${kind.toLowerCase()}`);
    if (text && text.trim()) {
      const emoji = kind === 'Poll' ? '📊' : kind === 'Quiz' ? '📝' : '❓';
      try {
        const newPost = await createChannelPost(channelId, {
          title: `${emoji} ${kind}`,
          body: text.trim(),
          authorName: authStore.company?.name || 'Hirer'
        });
        setPosts([newPost, ...posts]);
        triggerToast(`${kind} posted`);
      } catch (err) {
        alert(`Failed to post ${kind}`);
      }
    }
  };

  const handleAttach = (action: AttachAction) => {
    if (action === 'image') pickImageAndPost();
    else promptAndPost(action);
  };

  const stopRecordTimer = () => {
    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = null;
    }
  };

  const startRecording = () => {
    setAttachMenuOpen(false);
    setIsRecording(true);
    setRecordSeconds(0);
    recordIntervalRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000);
  };

  const cancelRecording = () => {
    stopRecordTimer();
    setIsRecording(false);
    setRecordSeconds(0);
  };

  const sendRecording = async () => {
    stopRecordTimer();
    const mm = Math.floor(recordSeconds / 60);
    const ss = String(recordSeconds % 60).padStart(2, '0');
    
    try {
      const newPost = await createChannelPost(channelId, {
        body: `🎤 Voice message · ${mm}:${ss}`,
        authorName: authStore.company?.name || 'Hirer'
      });
      setPosts([newPost, ...posts]);
      setIsRecording(false);
      setRecordSeconds(0);
      triggerToast('Voice message sent');
    } catch(err) {
      alert('Failed to send voice message');
    }
  };

  useEffect(() => stopRecordTimer, []);

  if (!channel) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgScreen, justifyContent: 'center', alignItems: 'center' }}>
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
              onPress={() => { setShowDropdown(false); alert(`Showing member management for ${channel.name}`); }}
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

          {isRecording ? (
            /* Recording bar */
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
              }}
            >
              <TouchableOpacity onPress={cancelRecording} style={{ padding: 4 }}>
                <Trash2 size={20} color="#EF4444" />
              </TouchableOpacity>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444' }} />
                <Text style={{ fontSize: 14, color: Colors.textBody, fontWeight: '600' }} className="font-sans">
                  {Math.floor(recordSeconds / 60)}:{String(recordSeconds % 60).padStart(2, '0')}
                </Text>
                <Text style={{ fontSize: 12, color: Colors.textMuted }} className="font-sans">
                  Recording voice message...
                </Text>
              </View>
              <TouchableOpacity
                onPress={sendRecording}
                style={{
                  width: 40, height: 40, borderRadius: 20,
                  backgroundColor: Colors.primary,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Send size={16} color={Colors.white} />
              </TouchableOpacity>
            </View>
          ) : (
            /* Input row */
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
            >
              <TouchableOpacity onPress={() => setAttachMenuOpen(prev => !prev)} style={{ padding: 4 }}>
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
                style={{
                  flex: 1,
                  backgroundColor: Colors.bgScreen,
                  borderRadius: 24,
                  paddingHorizontal: 16,
                  height: 44,
                  fontSize: 13,
                  color: Colors.textBody,
                  outline: 'none',
                } as any}
                className="font-sans"
              />

              {announceText.trim() ? (
                <TouchableOpacity
                  onPress={handleSendText}
                  style={{
                    width: 40, height: 40, borderRadius: 20,
                    backgroundColor: Colors.primary,
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Send size={16} color={Colors.white} />
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity onPress={pickImageAndPost} style={{ padding: 4 }}>
                    <Camera size={22} color={Colors.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={startRecording} style={{ padding: 4 }}>
                    <Mic size={22} color={Colors.textMuted} />
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
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
    </SafeAreaView>
  );
}
