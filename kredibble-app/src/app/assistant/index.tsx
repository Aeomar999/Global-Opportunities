import React, { useState, useRef, useEffect } from 'react';
import { Colors } from '../../constants/design';
import { View, Text, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform, StyleSheet, Keyboard, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Send } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle, Ellipse, Polygon } from 'react-native-svg';
import { authStore } from '../../constants/authStore';
import { sendAssistantMessage, AssistantChatMessage } from '../../lib/api';

// ─── Wave Penguin Logo SVG ───────────────────────────────────────────────────
const WaveLogoSVG = () => (
  <Svg width="36" height="36" viewBox="0 0 100 100">
    <Circle cx="50" cy="50" r="48" fill="#00BCD4" />
    <Ellipse cx="50" cy="53" rx="20" ry="26" fill="#1A1A1A" />
    <Ellipse cx="50" cy="57" rx="13" ry="18" fill="#FFFFFF" />
    <Circle cx="44" cy="40" r="3.5" fill="#FFFFFF" />
    <Circle cx="44" cy="40" r="1.5" fill="#000000" />
    <Circle cx="56" cy="40" r="3.5" fill="#FFFFFF" />
    <Circle cx="56" cy="40" r="1.5" fill="#000000" />
    <Polygon points="45,46 55,46 50,54" fill="#FBBF24" />
    <Ellipse cx="40" cy="78" rx="8" ry="4" fill="#FBBF24" />
    <Ellipse cx="60" cy="78" rx="8" ry="4" fill="#FBBF24" />
  </Svg>
);

// ─── Kredibble AI Assistant Avatar ──────────────────────────────────────────
const AssistantAvatar = () => (
  <Image source={require('../../../assets/images/logo.png')} style={{ width: 36, height: 36, borderRadius: 18 }} resizeMode="contain" />
);

// ─── Job & Candidate Interfaces ─────────────────────────────────────────────
interface Job {
  id: string;
  title: string;
  location: string;
  company: string;
  description: string;
}

interface Candidate {
  id: string;
  name: string;
  profession: string;
  university: string;
  image: string;
  matchScore: number;
}

interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  jobs?: Job[];
  candidates?: Candidate[];
}

export default function AssistantScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [role, setRole] = useState(authStore.role);
  useEffect(() => {
    // State is initialised from authStore; the subscription keeps it in sync.
    const unsubscribe = authStore.subscribe(() => setRole(authStore.role));
    return unsubscribe;
  }, []);
  const isHirer = role === 'hirer';

  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'ai',
      text: isHirer
        ? "Hi, I'm your AI recruiting assistant. Need help finding candidates, writing a job post, or reviewing applicants?"
        : "Hi, I'm your AI assistant. Got any career-related questions?",
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    // Scroll to bottom when messages list changes
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages, isTyping]);

  const handleSend = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || isTyping) return;

    // 1. Add User Message
    const userMsgId = Date.now().toString();
    const userMessage: Message = {
      id: userMsgId,
      sender: 'user',
      text: trimmed,
    };
    const newMessages: Message[] = [...messages, userMessage];
    setMessages(newMessages);
    setInputText('');

    // 2. Trigger typing indicator
    setIsTyping(true);

    try {
      // 3. Format chat payload for backend /api/v1/assistant/chat (keep last 10 messages)
      const historyPayload: AssistantChatMessage[] = newMessages
        .filter((msg) => Boolean(msg.text))
        .slice(-10)
        .map((msg) => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text,
        }));

      const res = await sendAssistantMessage(historyPayload);
      const replyText = res?.message || 'No response received from assistant.';

      const reply: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: replyText,
      };
      setMessages((prev) => [...prev, reply]);
    } catch (error: any) {
      const is503 =
        error?.status === 503 ||
        (typeof error?.message === 'string' &&
          (error.message.includes('503') ||
            error.message.toLowerCase().includes('unavailable') ||
            error.message.toLowerCase().includes('not enabled')));

      const fallbackText = is503
        ? 'AI smart assistant is currently undergoing scheduled maintenance. Please check back shortly.'
        : error?.message && typeof error.message === 'string'
        ? `Unable to reach assistant: ${error.message}`
        : 'AI smart assistant is currently undergoing scheduled maintenance. Please check back shortly.';

      const reply: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: fallbackText,
      };
      setMessages((prev) => [...prev, reply]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: Colors.bgScreen }}
      keyboardVerticalOffset={0}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}
          style={styles.backButton}
        >
          <ChevronLeft size={24} color={Colors.textMuted} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} className="font-sans">
          AI smart assistant
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Chat Messages */}
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg) => (
            <View
              key={msg.id}
              style={[
                styles.messageRow,
                msg.sender === 'user' ? styles.userRow : styles.aiRow,
              ]}
            >
              {/* Avatar on left for AI */}
              {msg.sender === 'ai' && (
                <View style={styles.avatarContainer}>
                  <AssistantAvatar />
                </View>
              )}

              {/* Chat Bubble */}
              <View
                style={[
                  styles.bubble,
                  msg.sender === 'user' ? styles.userBubble : styles.aiBubble,
                ]}
              >
                <Text
                  style={[
                    styles.bubbleText,
                    msg.sender === 'user' ? styles.userText : styles.aiText,
                  ]}
                  className="font-sans"
                >
                  {msg.text}
                </Text>

                {/* Optional nested Job Cards */}
                {msg.jobs && msg.jobs.length > 0 && (
                  <View style={styles.jobsContainer}>
                    {msg.jobs.map((job, idx) => (
                      <TouchableOpacity
                        key={idx}
                        activeOpacity={0.85}
                        onPress={() => router.push(`/jobs/${job.id}`)}
                        style={styles.jobCard}
                      >
                        <View style={styles.jobCardRow}>
                          <View style={styles.jobLogo}>
                            <WaveLogoSVG />
                          </View>
                          <View style={styles.jobInfo}>
                            <Text numberOfLines={2} style={styles.jobTitle} className="font-sans">
                              {job.title} <Text style={styles.jobDot}>·</Text> <Text style={styles.jobLoc}>{job.location}</Text>
                            </Text>
                            <Text style={styles.jobCompany} className="font-sans">
                              {job.company}
                            </Text>
                            <Text numberOfLines={2} style={styles.jobDesc} className="font-sans">
                              {job.description}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Optional nested Candidate Cards (Hirer role) */}
                {msg.candidates && msg.candidates.length > 0 && (
                  <View style={styles.jobsContainer}>
                    {msg.candidates.map((candidate) => (
                      <TouchableOpacity
                        key={candidate.id}
                        activeOpacity={0.85}
                        onPress={() => router.push(`/experts/${candidate.id}`)}
                        style={styles.jobCard}
                      >
                        <View style={styles.jobCardRow}>
                          <Image source={{ uri: candidate.image }} style={styles.candidateAvatar} />
                          <View style={styles.jobInfo}>
                            <Text numberOfLines={2} style={styles.jobTitle} className="font-sans">
                              {candidate.name} <Text style={styles.jobDot}>·</Text> <Text style={styles.jobLoc}>{candidate.matchScore}% match</Text>
                            </Text>
                            <Text style={styles.jobCompany} className="font-sans">
                              {candidate.profession}
                            </Text>
                            <Text numberOfLines={1} style={styles.jobDesc} className="font-sans">
                              {candidate.university}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <View style={[styles.messageRow, styles.aiRow]}>
              <View style={styles.avatarContainer}>
                <AssistantAvatar />
              </View>
              <View style={[styles.bubble, styles.aiBubble, styles.typingBubble]}>
                <View style={styles.typingIndicator}>
                  <View style={[styles.typingDot, styles.typingDot1]} />
                  <View style={[styles.typingDot, styles.typingDot2]} />
                  <View style={[styles.typingDot, styles.typingDot3]} />
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Bottom Input Area */}
        <View style={[styles.inputWrapper, { paddingBottom: keyboardVisible ? 8 : (insets.bottom > 0 ? insets.bottom : 16) }]}>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, { outline: 'none' } as any]}
              placeholder={isHirer ? 'Ask about candidates, hiring, or postings' : 'Ask about companies, pay, or jobs'}
              placeholderTextColor={Colors.textMuted}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSend}
              className="font-sans"
            />
            <TouchableOpacity
              onPress={handleSend}
              activeOpacity={0.8}
              style={styles.sendButton}
            >
              <Send size={18} color={Colors.white} fill={Colors.white} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '500',
    color: Colors.textBody,
  },
  headerSpacer: {
    width: 40,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'flex-start',
    width: '100%',
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  aiRow: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    marginRight: 10,
    marginTop: 2,
  },
  bubble: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: '86%',
  },
  userBubble: {
    // Approved design: orange user bubble. White text on #FC5E24 is 3.10:1 (see docs/mobile-design-brief.md).
    backgroundColor: Colors.accent500,
  },
  aiBubble: {
    backgroundColor: Colors.bgCard,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
  },
  userText: {
    color: '#FFFFFF',
    fontWeight: '400',
  },
  aiText: {
    color: Colors.textBody,
    fontWeight: '400',
  },
  jobsContainer: {
    marginTop: 12,
    gap: 10,
  },
  jobCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    padding: 12,
  },
  jobCardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  jobLogo: {
    marginRight: 10,
  },
  candidateAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    backgroundColor: '#EBEBEE',
  },
  jobInfo: {
    flex: 1,
  },
  jobTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  jobDot: {
    color: '#9CA3AF',
    marginHorizontal: 2,
  },
  jobLoc: {
    color: '#8A8D9F',
    fontWeight: '400',
  },
  jobCompany: {
    fontSize: 11,
    color: '#8A8D9F',
    marginTop: 1,
  },
  jobDesc: {
    fontSize: 10.5,
    color: '#8A8D9F',
    marginTop: 6,
    lineHeight: 15,
  },
  suggestionsContainer: {
    paddingHorizontal: 16,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryTransparent,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.purple100,
  },
  suggestionText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500',
  },
  inputWrapper: {
    backgroundColor: Colors.bgScreen,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 30,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  input: {
    flex: 1,
    height: 40,
    fontSize: 14,
    color: Colors.textBody,
    paddingHorizontal: 4,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typingBubble: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 10,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#9CA3AF',
  },
  typingDot1: {
    opacity: 0.5,
  },
  typingDot2: {
    opacity: 0.75,
  },
  typingDot3: {
    opacity: 1,
  },
});
