import { View, Text, TouchableOpacity, ScrollView, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Bookmark, Clock, Share2 } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/design';
import { getArticle, initialsOf, useNewsSaved } from '../../constants/mockNews';
import { useToast } from '../../components/ui/ToastProvider';

export default function NewsArticleScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const article = getArticle(String(id));
  const [saved, toggleSaved] = useNewsSaved(article?.id);
  const { showToast } = useToast();

  if (!article) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgScreen, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: Colors.textMuted }}>Article not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 12 }}>
          <Text style={{ color: Colors.primary, fontWeight: '600' }}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const [lead, ...rest] = article.body;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.primary }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: Colors.primary }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8 }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
            <ChevronLeft size={26} color={Colors.white} />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 20 }}>
            <TouchableOpacity
              hitSlop={10}
              onPress={() => Share.share({ message: `${article.title}\n\nRead more on Kredibble.` })}
              accessibilityRole="button"
              accessibilityLabel="Share"
            >
              <Share2 size={20} color={Colors.white} />
            </TouchableOpacity>
            <TouchableOpacity
              hitSlop={10}
              onPress={() => showToast(toggleSaved() ? 'Article saved' : 'Removed from saved', 'info')}
              accessibilityRole="button"
              accessibilityLabel={saved ? 'Remove from saved' : 'Save article'}
            >
              <Bookmark size={20} color={Colors.white} fill={saved ? Colors.white : 'transparent'} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        {/* Hero */}
        <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 44, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', right: -60, top: -30, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.08)' }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <View style={{ backgroundColor: Colors.accent600, borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: Colors.white, fontSize: 11, fontWeight: '700' }}>{article.category}</Text>
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>{article.date}</Text>
          </View>
          <Text style={{ color: Colors.white, fontSize: 26, lineHeight: 34 }} className="font-heading font-extrabold">{article.title}</Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 20, gap: 10 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: Colors.white, fontSize: 13, fontWeight: '700' }}>{initialsOf(article.author)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: Colors.white, fontSize: 13, fontWeight: '600' }}>{article.author}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Clock size={12} color="rgba(255,255,255,0.8)" />
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>{article.readMinutes} min read</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Article sheet */}
        <View style={{ backgroundColor: Colors.bgCard, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 22, paddingTop: 28, paddingBottom: 48, minHeight: 500 }}>
          <Text style={{ fontSize: 17, lineHeight: 28, color: Colors.textBody, fontWeight: '600', marginBottom: 18 }}>{lead}</Text>
          {rest.map((p, i) => (
            <Text key={i} style={{ fontSize: 16, lineHeight: 27, color: Colors.textBody, marginBottom: 18 }}>{p}</Text>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
