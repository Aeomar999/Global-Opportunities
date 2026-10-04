"use client";

/**
 * Career Resources: the articles shown in the app's Career Resources section.
 * Built on the shared list template; this file holds the column config and the data.
 * Data: mock articles (src/lib/mock-articles.ts), unchanged. "New Article" is the primary action.
 */
import { FileText, Plus } from "lucide-react";
import { articles, type Article } from "@/lib/mock-articles";
import { useListData } from "@/lib/use-list-data";
import { DataTable } from "@/components/list/DataTable";
import { ListPage } from "@/components/list/ListPage";
import type { Column } from "@/components/list/types";

const loadArticles = () => Promise.resolve(articles);

const COLUMNS: Column<Article>[] = [
  {
    key: "title",
    header: "Title",
    type: "primary",
    width: "42%",
    title: (r) => r.title,
    // A 36px thumbnail when the article has a banner, otherwise a document tile.
    leading: (r) => ({ icon: FileText, imageSrc: r.bannerImage }),
  },
  { key: "category", header: "Category", type: "text", width: "20%", value: (r) => r.category },
  { key: "readTime", header: "Read time", type: "text", width: "16%", value: (r) => r.duration },
  { key: "status", header: "Status", type: "status", width: "22%", status: (r) => r.status },
];

export default function ArticlesListPage() {
  const { rows, isLoading, error, retry } = useListData(loadArticles);
  const draftCount = (rows ?? []).filter((a) => a.status === "draft").length;

  return (
    <ListPage
      title="Career Resources"
      subtitle={
        rows
          ? `Articles shown in the Career Resources section of the app. ${draftCount} draft not yet published.`
          : "Articles shown in the Career Resources section of the app."
      }
      action={{ label: "New Article", href: "/content/articles/new", icon: Plus }}
    >
      <DataTable
        label="Articles"
        columns={COLUMNS}
        rows={rows ?? []}
        getRowKey={(r) => r.id}
        getRowHref={(r) => `/content/articles/${r.id}`}
        loading={isLoading}
        error={error}
        onRetry={retry}
        emptyNoData={{ icon: FileText, title: "No articles yet", description: "Create the first Career Resources article with New Article." }}
        emptyNoResults={{ icon: FileText, title: "No articles match" }}
      />
    </ListPage>
  );
}
