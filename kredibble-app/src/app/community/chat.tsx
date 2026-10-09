import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MessageCircle, MessageCircleOff, Send } from 'lucide-react-native';
import { Colors, Radius } from '../../constants/design';
import { Header } from '../../components/ui/Header';
import { useToast } from '../../components/ui/ToastProvider';
import { socketService } from '../../lib/socket';
import { getChannelMessages, sendChannelMessage, type ChatMessage } from '../../lib/api';

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/**
 * A channel works like a WhatsApp channel: admins post, everyone reads, and each post says whether members may reply.
 * Members open a post to read its replies and, when replies are on, add their own. Admins also choose "Allow replies"
 * when they write a post. New posts, reply counts and the replies setting update live over the socket.
 */
export default function ChannelChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; name?: string }>();
  const channelId = String(params.id || '');
  const { showToast } = useToast();

  const [posts, setPosts] = useState<ChatMessage[] | null>(null);
  const [canPost, setCanPost] = useState(false);
  const [draft, setDraft] = useState('');
  const [allowReplies, setAllowReplies] = useState(true);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    if (!channelId) return;
    let cancelled = false;
    getChannelMessages(channelId)
      .then(result => {
        if (cancelled) return;
        setPosts(result.posts);
        setCanPost(result.canPost);
      })
      .catch(err => { if (!cancelled) setFailed(err instanceof Error ? err.message : 'Could not load the channel.'); });
    return () => { cancelled = true; };
  }, [channelId]);

  // Live updates: a new post, a reply (bumps the count), or a changed replies setting.
  useEffect(() => {
    if (!channelId) return;
    let cancelled = false;
    let attached: any = null;

    const onMessage = (message: ChatMessage) => {
      if (message?.channelId !== channelId) return;
      if (message.parentId) {
        setPosts(prev => prev?.map(p => (p.id === message.parentId ? { ...p, replyCount: p.replyCount + 1 } : p)) ?? prev);
      } else {
        setPosts(prev => (prev && prev.some(p => p.id === message.id) ? prev : [...(prev ?? []), message]));
      }
    };
    const onUpdated = (message: ChatMessage) => {
      if (message?.channelId !== channelId) return;
      setPosts(prev => prev?.map(p => (p.id === message.id ? { ...p, allowReplies: message.allowReplies } : p)) ?? prev);
    };

    socketService
      .connect()
      .then(() => {
        if (cancelled || !socketService.socket) return;
        attached = socketService.socket;
        attached.emit('join_channel', channelId);
        attached.on('chat_message', onMessage);
        attached.on('chat_message_updated', onUpdated);
      })
      .catch(() => {
        // Realtime is an enhancement; the posts above still load.
      });
    return () => {
      cancelled = true;
      if (attached) {
        attached.off('chat_message', onMessage);
        attached.off('chat_message_updated', onUpdated);
      }
    };
  }, [channelId]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const saved = await sendChannelMessage(channelId, body, { allowReplies });
      setPosts(prev => (prev && prev.some(p => p.id === saved.id) ? prev : [...(prev ?? []), saved]));
      setDraft('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Your post could not be sent.', 'error');
    } finally {
      setSending(false);
    }
  };

  const openThread = (post: ChatMessage) =>
    router.push({ pathname: '/community/thread', params: { channelId, messageId: post.id, name: params.name ? String(params.name) : '' } } as any);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.white }} edges={['top', 'left', 'right']}>
      <Header title={params.name ? String(params.name) : 'Channel'} showBack />
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: Colors.bgScreen }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {posts === null && !failed ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : failed ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <Text style={{ color: Colors.textMuted, textAlign: 'center' }} className="font-sans">{failed}</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={posts ?? []}
            keyExtractor={p => p.id}
            contentContainerStyle={{ padding: 16, flexGrow: 1 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: Colors.textMuted, textAlign: 'center' }} className="font-sans">
                  {canPost ? 'No posts yet. Write the first one below.' : 'No posts yet. Updates from the Kredibble team will appear here.'}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={{ marginBottom: 14 }}>
                <View
                  style={{
                    alignSelf: 'flex-start', maxWidth: '92%', backgroundColor: Colors.bgCard, borderWidth: 1,
                    borderColor: Colors.borderDefault, borderRadius: Radius.card, paddingHorizontal: 14, paddingVertical: 12,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.accent700, marginBottom: 4 }} className="font-sans">
                    {item.senderName}{item.senderRole === 'admin' ? '  ·  Kredibble team' : ''}
                  </Text>
                  <Text style={{ fontSize: 15, lineHeight: 22, color: Colors.textBody }} className="font-sans">{item.body}</Text>
                  <Text style={{ fontSize: 10, marginTop: 6, alignSelf: 'flex-end', color: Colors.textMuted }} className="font-sans">{timeOf(item.createdAt)}</Text>
                </View>

                <TouchableOpacity
                  onPress={() => openThread(item)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={item.allowReplies ? 'Open replies' : 'Replies are off'}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, marginLeft: 4, alignSelf: 'flex-start' }}
                >
                  {item.allowReplies ? <MessageCircle size={16} color={Colors.primary} /> : <MessageCircleOff size={16} color={Colors.textMuted} />}
                  <Text style={{ fontSize: 13, fontWeight: '600', color: item.allowReplies ? Colors.primary : Colors.textMuted }} className="font-sans">
                    {item.allowReplies
                      ? item.replyCount === 0 ? 'Reply' : `${item.replyCount} ${item.replyCount === 1 ? 'reply' : 'replies'}`
                      : item.replyCount > 0 ? `Replies off · ${item.replyCount}` : 'Replies are off'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          />
        )}

        {canPost ? (
          <View style={{ padding: 12, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.borderDefault, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Write a post"
                placeholderTextColor={Colors.textMuted}
                multiline
                maxLength={2000}
                style={{
                  flex: 1, maxHeight: 110, minHeight: 48, borderRadius: Radius.control, borderWidth: 1, borderColor: Colors.borderInput,
                  paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.textBody, backgroundColor: Colors.bgCard,
                }}
              />
              <TouchableOpacity
                onPress={send}
                disabled={!draft.trim() || sending}
                accessibilityRole="button"
                accessibilityLabel="Send post"
                style={{
                  width: 48, height: 48, borderRadius: Radius.control, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: !draft.trim() || sending ? Colors.primary10 : Colors.primary,
                }}
              >
                {sending ? <ActivityIndicator color={Colors.primary} /> : <Send size={20} color={!draft.trim() ? Colors.primary : Colors.white} />}
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 13, color: Colors.textBody }} className="font-sans">Allow members to reply</Text>
              <Switch
                value={allowReplies}
                onValueChange={setAllowReplies}
                trackColor={{ false: Colors.borderInput, true: Colors.primary }}
                thumbColor={Colors.white}
                accessibilityLabel="Allow members to reply"
              />
            </View>
          </View>
        ) : (
          <View style={{ padding: 14, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.borderDefault }}>
            <Text style={{ fontSize: 12, color: Colors.textBody, fontWeight: '300', textAlign: 'center' }} className="font-sans">
              Only admins can post here. You can reply to posts that allow replies.
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
