import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Send, MessageCircleOff } from 'lucide-react-native';
import { Colors, Radius } from '../../constants/design';
import { Header } from '../../components/ui/Header';
import { useToast } from '../../components/ui/ToastProvider';
import { authStore } from '../../constants/authStore';
import { socketService } from '../../lib/socket';
import { getChannelThread, sendChannelMessage, type ChatMessage } from '../../lib/api';

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/**
 * One post and the replies under it. The reply box shows only while replies are on for the post (or when you are an admin);
 * if an admin turns replies off while you are here, the box is replaced by a short note straight away.
 */
export default function ThreadScreen() {
  const params = useLocalSearchParams<{ channelId?: string; messageId?: string; name?: string }>();
  const channelId = String(params.channelId || '');
  const messageId = String(params.messageId || '');
  const { showToast } = useToast();
  const myId = authStore.user?.id;

  const [post, setPost] = useState<ChatMessage | null>(null);
  const [replies, setReplies] = useState<ChatMessage[]>([]);
  const [isManager, setIsManager] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const addReply = useCallback((message: ChatMessage) => {
    setReplies(prev => (prev.some(r => r.id === message.id) ? prev : [...prev, message]));
  }, []);

  useEffect(() => {
    if (!channelId || !messageId) return;
    let cancelled = false;
    getChannelThread(channelId, messageId)
      .then(result => {
        if (cancelled) return;
        setPost(result.post);
        setReplies(result.replies);
        setIsManager(result.canManage);
      })
      .catch(err => { if (!cancelled) setFailed(err instanceof Error ? err.message : 'Could not load this post.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [channelId, messageId]);

  useEffect(() => {
    if (!channelId || !messageId) return;
    let cancelled = false;
    let attached: any = null;
    const onMessage = (message: ChatMessage) => {
      if (message?.channelId === channelId && message.parentId === messageId) addReply(message);
    };
    const onUpdated = (message: ChatMessage) => {
      if (message?.id !== messageId) return;
      setPost(prev => (prev ? { ...prev, allowReplies: message.allowReplies } : prev));
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
      .catch(() => {});
    return () => {
      cancelled = true;
      if (attached) {
        attached.off('chat_message', onMessage);
        attached.off('chat_message_updated', onUpdated);
      }
    };
  }, [channelId, messageId, addReply]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      addReply(await sendChannelMessage(channelId, body, { parentId: messageId }));
      setDraft('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Your reply could not be sent.';
      showToast(message, 'error');
      if (/turned off/i.test(message)) setPost(prev => (prev ? { ...prev, allowReplies: false } : prev));
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.white }} edges={['top', 'left', 'right']}>
      <Header title="Replies" showBack />
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: Colors.bgScreen }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : failed || !post ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <Text style={{ color: Colors.textMuted, textAlign: 'center' }} className="font-sans">{failed ?? 'This post is no longer available.'}</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={replies}
            keyExtractor={r => r.id}
            contentContainerStyle={{ padding: 16, flexGrow: 1 }}
            ListHeaderComponent={
              <View style={{ backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.borderDefault, borderRadius: Radius.card, padding: 14, marginBottom: 16 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.accent700, marginBottom: 4 }} className="font-sans">
                  {post.senderName}{post.senderRole === 'admin' ? '  ·  Kredibble team' : ''}
                </Text>
                <Text style={{ fontSize: 15, lineHeight: 22, color: Colors.textBody }} className="font-sans">{post.body}</Text>
                <Text style={{ fontSize: 10, marginTop: 6, alignSelf: 'flex-end', color: Colors.textMuted }} className="font-sans">{timeOf(post.createdAt)}</Text>
              </View>
            }
            ListEmptyComponent={
              <Text style={{ color: Colors.textMuted, textAlign: 'center', marginTop: 24 }} className="font-sans">
                {post.allowReplies ? 'No replies yet. Be the first to reply.' : 'No replies.'}
              </Text>
            }
            renderItem={({ item }) => {
              const mine = item.senderId === myId;
              return (
                <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
                  <View
                    style={{
                      maxWidth: '84%', backgroundColor: mine ? Colors.primary : Colors.bgCard, borderWidth: mine ? 0 : 1,
                      borderColor: Colors.borderDefault, borderRadius: Radius.card, paddingHorizontal: 14, paddingVertical: 10,
                    }}
                  >
                    {!mine && (
                      <Text style={{ fontSize: 12, fontWeight: '700', color: item.senderRole === 'admin' ? Colors.accent700 : Colors.primary, marginBottom: 2 }} className="font-sans">
                        {item.senderName}{item.senderRole === 'admin' ? '  ·  Kredibble team' : ''}
                      </Text>
                    )}
                    <Text style={{ fontSize: 14, lineHeight: 20, color: mine ? Colors.white : Colors.textBody }} className="font-sans">{item.body}</Text>
                    <Text style={{ fontSize: 10, marginTop: 4, alignSelf: 'flex-end', color: mine ? 'rgba(255,255,255,0.8)' : Colors.textMuted }} className="font-sans">
                      {timeOf(item.createdAt)}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        )}

        {post && (isManager || post.allowReplies ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.borderDefault }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Write a reply"
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
              accessibilityLabel="Send reply"
              style={{
                width: 48, height: 48, borderRadius: Radius.control, alignItems: 'center', justifyContent: 'center',
                backgroundColor: !draft.trim() || sending ? Colors.primary10 : Colors.primary,
              }}
            >
              {sending ? <ActivityIndicator color={Colors.primary} /> : <Send size={20} color={!draft.trim() ? Colors.primary : Colors.white} />}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.borderDefault }}>
            <MessageCircleOff size={16} color={Colors.textBody} />
            <Text style={{ fontSize: 12, color: Colors.textBody, fontWeight: '300' }} className="font-sans">Replies are turned off for this post.</Text>
          </View>
        ))}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
