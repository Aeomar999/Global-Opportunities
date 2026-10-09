import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bookmark, Clock } from 'lucide-react-native';
import { Header } from '../../components/ui/Header';
import { useRouter } from 'expo-router';
import { Colors, Radius } from '../../constants/design';
import { useSavedArticles, useNewsSaved } from '../../constants/mockNews';
import type { NewsArticle } from '../../constants/mockNews';

const SavedRow = ({ item, onPress }: { item: NewsArticle; onPress: () => void }) => {
  const [, toggle] = useNewsSaved(item.id);
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={{ backgroundColor: Colors.bgCard, borderRadius: Radius.card, padding: 16, marginBottom: 12, flexDirection: 'row', gap: 12 }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.accent700, marginBottom: 4 }}>{item.category.toUpperCase()}</Text>
        <Text numberOfLines={3} style={{ fontSize: 15, lineHeight: 21, color: Colors.textBody }} className="font-heading font-semibold">
          {item.title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
          <Clock size={12} color={Colors.textMuted} />
          <Text style={{ fontSize: 12, color: Colors.textMuted }}>{item.author} · {item.readMinutes} min</Text>
        </View>
      </View>
      <TouchableOpacity onPress={toggle} hitSlop={10} accessibilityRole="button" accessibilityLabel="Remove from saved">
        <Bookmark size={20} color={Colors.primary} fill={Colors.primary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

export default function SavedArticlesScreen() {
  const router = useRouter();
  const articles = useSavedArticles();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgScreen }} edges={['top', 'left', 'right']}>
      <Header title="Saved articles" showBack />

      <FlatList
        data={articles}
        keyExtractor={a => a.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32, flexGrow: 1 }}
        renderItem={({ item }) => (
          <SavedRow item={item} onPress={() => router.push({ pathname: '/news/[id]', params: { id: item.id } } as any)} />
        )}
        ListEmptyComponent={
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 }}>
            <Bookmark size={32} color={Colors.textMuted} />
            <Text style={{ marginTop: 12, color: Colors.textMuted, textAlign: 'center' }}>No saved articles yet.{'\n'}Tap the bookmark on an article to keep it here.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
