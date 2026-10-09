import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Modal, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Search, Clock, X, BookOpen } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Colors, FontSize, FontWeight, Radius, LineHeight, Size } from '../../constants/design';
import { getArticles } from '../../lib/api';


interface Article {
  id: string;
  category: string;
  title: string;
  duration: string;
  summary: string;
  content: string;
}

const ARTICLES: Article[] = [
  {
    id: '1',
    category: 'Resume Writing',
    title: 'How to write a developer resume that gets noticed',
    duration: '5 min read',
    summary: 'Learn key formatting guidelines, action verbs, and structural details that make your engineering resume stand out to recruiters.',
    content: `Writing a great software developer resume is about demonstrating impact, not just listing technologies. Recruiters spend an average of 6 seconds scanning a CV. Here are key strategies to make your resume stand out:\n\n1. Keep it Concise\nLimit your resume to 1-2 pages maximum. Put your most impressive and recent experience at the top. Use clean layouts and bullet points for scan-readability.\n\n2. Focus on Impact\nUse the Action-Result format. Instead of saying "worked on the backend", say "Re-architected query layers, reducing search database latency by 40%". Quantify your accomplishments whenever possible.\n\n3. Match Job Keywords\nTailor your skills section to include language directly from the job description. Automated applicant tracking systems (ATS) look for matching terms to filter candidates.\n\n4. Link Projects & Portfolios\nEnsure your GitHub, personal portfolio website, and LinkedIn profiles are updated and hyperlinked. Live projects provide proof of your capabilities.`
  },
  {
    id: '2',
    category: 'Interview Prep',
    title: 'Mastering behavioral interviews: The STAR Method',
    duration: '8 min read',
    summary: 'A complete walkthrough of the Situation, Task, Action, and Result framework to successfully answer behavioral questions.',
    content: `Behavioral interview questions ("Tell me about a time you resolved a conflict...") are designed to predict future performance based on past actions. The STAR method is the gold standard for structuring answers:\n\n• Situation\nDescribe the context of the challenge you faced. Keep this concise and set the scene.\n\n• Task\nExplain your responsibility or the goal you needed to achieve in that situation.\n\n• Action\nOutline the exact steps you took to address the issue. Be specific about your contribution, even if it was a team project. Use "I did" instead of "We did".\n\n• Result\nState the outcome of your actions. Quantify achievements (e.g. saved 10 hours per week, increased sales by 15%) whenever possible.\n\nPractice beforehand by preparing 4-5 core stories that can adapt to different themes like leadership, technical difficulty, or handling failures.`
  },
  {
    id: '3',
    category: 'Career Planning',
    title: 'Top 10 skills for Product Designers in 2026',
    duration: '4 min read',
    summary: 'Discover the essential soft and technical skills required to remain competitive as a modern UI/UX and product designer.',
    content: `The landscape of digital design is evolving rapidly. To stand out as a Product Designer, focus on mastering these key pillars:\n\n1. Advanced Prototyping\nCreating interactive, high-fidelity micro-interactions inside tools like Figma to communicate design flows effectively.\n\n2. Design Systems Governance\nUnderstanding how to build, scale, and maintain shared component libraries that align with developer frameworks.\n\n3. Business and Product Strategy\nDesigning with metrics in mind. Knowing how your layouts impact conversion rates, retention, and business growth.\n\n4. Design Tokens & Code Literacy\nFamiliarity with CSS/React layouts to improve communication and handoff with developers.`
  }
];

export default function CareerResourcesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeArticle, setActiveArticle] = useState<Article | null>(null);
  
  const [articles, setArticles] = useState<Article[]>(ARTICLES);

  React.useEffect(() => {
    const fetchArticles = async () => {
      try {
        const data = await getArticles();
        if (data && data.length > 0) {
          setArticles(data);
        }
      } catch (err) {
        console.warn('Failed to load articles from API', err);
      }
    };
    fetchArticles();
  }, []);

  const categories = ['All', 'Resume Writing', 'Interview Prep', 'Career Planning'];

  const filteredArticles = articles.filter(article => {
    const matchesSearch = article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          article.summary.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || article.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F7F9' }} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}
          style={styles.backButton}
        >
          <ChevronLeft size={20} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} className="font-sans">
          Career resources center
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Main Content */}
      <View style={{ flex: 1 }}>
        {/* Search & Filters container */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Search size={18} color="#A1A1AA" style={{ marginRight: 10 }} />
            <TextInput
              placeholder="Search guides and playbooks..."
              placeholderTextColor="#A1A1AA"
              style={[styles.input, { outline: 'none' } as any]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="font-sans"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={16} color="#A1A1AA" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Category Filter Tabs */}
        <View style={styles.categoriesWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesScroll}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                style={[
                  styles.categoryTab,
                  selectedCategory === cat && styles.activeCategoryTab
                ]}
              >
                <Text
                  style={[
                    styles.categoryTabText,
                    selectedCategory === cat && styles.activeCategoryTabText
                  ]}
                  className="font-sans"
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Articles List */}
        <ScrollView
          contentContainerStyle={[styles.articlesScrollContent, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
        >
          {filteredArticles.length > 0 ? (
            filteredArticles.map((article) => (
              <TouchableOpacity
                key={article.id}
                activeOpacity={0.8}
                onPress={() => setActiveArticle(article)}
                style={styles.articleCard}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTag} className="font-sans">
                    {article.category.toUpperCase()}
                  </Text>
                  <View style={styles.durationBadge}>
                    <Clock size={12} color="#8A8D9F" style={{ marginRight: 4 }} />
                    <Text style={styles.durationText} className="font-sans">
                      {article.duration}
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardTitle} className="font-sans">
                  {article.title}
                </Text>
                <Text numberOfLines={2} style={styles.cardSummary} className="font-sans">
                  {article.summary}
                </Text>
                <View style={styles.cardFooter}>
                  <Text style={styles.readMoreText} className="font-sans">
                    Read playbook
                  </Text>
                  <BookOpen size={14} color={Colors.primary} style={{ marginLeft: 4 }} />
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText} className="font-sans">
                No guides match your search parameters.
              </Text>
            </View>
          )}
        </ScrollView>
      </View>

      {/* Article Detail Modal */}
      <Modal
        visible={activeArticle !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setActiveArticle(null)}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalContainer} edges={['top', 'left', 'right', 'bottom']}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalCategory} className="font-sans">
                {activeArticle?.category.toUpperCase()}
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setActiveArticle(null)}
              >
                <X size={20} color="#1A1A1A" />
              </TouchableOpacity>
            </View>

            {/* Modal Body */}
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.modalTitle} className="font-sans">
                {activeArticle?.title}
              </Text>
              
              <View style={styles.modalMetaRow}>
                <Clock size={14} color="#8A8D9F" style={{ marginRight: 6 }} />
                <Text style={styles.modalDuration} className="font-sans">
                  {activeArticle?.duration}
                </Text>
              </View>

              <View style={styles.modalDivider} />

              <Text style={styles.modalBodyText} className="font-sans">
                {activeArticle?.content}
              </Text>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSize.screenTitle,
    fontWeight: FontWeight.semibold,
    color: Colors.textHeading,
  },
  headerSpacer: {
    width: 38,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: Colors.bgScreen,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.searchBar,
    paddingHorizontal: 16,
    height: Size.searchBarHeight,
  },
  input: {
    flex: 1,
    fontSize: FontSize.base,
    color: Colors.textBody,
  },
  categoriesWrapper: {
    backgroundColor: Colors.bgScreen,
    paddingBottom: 12,
  },
  categoriesScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  categoryTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  activeCategoryTab: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryTabText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
  },
  activeCategoryTabText: {
    color: Colors.white,
    fontWeight: FontWeight.semibold,
  },
  articlesScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  articleCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.card,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTag: {
    fontSize: FontSize.xs - 1,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  durationText: {
    fontSize: FontSize.xs - 1,
    color: Colors.textMuted,
  },
  cardTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textHeading,
    lineHeight: LineHeight.card,
    marginBottom: 6,
  },
  cardSummary: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    lineHeight: LineHeight.body,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  readMoreText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyText: {
    fontSize: FontSize.base,
    color: Colors.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.card,
    borderTopRightRadius: Radius.card,
    height: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDefault,
  },
  modalCategory: {
    fontSize: FontSize.xs - 1,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.bgAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textHeading,
    lineHeight: 28,
    marginBottom: 8,
  },
  modalMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalDuration: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
  },
  modalDivider: {
    height: 1,
    backgroundColor: Colors.borderDefault,
    marginBottom: 16,
  },
  modalBodyText: {
    fontSize: FontSize.base,
    lineHeight: 22,
    color: Colors.textSecondary,
  },
});
