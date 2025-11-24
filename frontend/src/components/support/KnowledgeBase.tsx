import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';

interface Category {
  id: string;
  name: string;
  article_count: number;
}

interface Article {
  id: string;
  title: string;
  slug: string;
  summary?: string;
  view_count: number;
  helpful_count: number;
  created_at: string;
}

export const KnowledgeBase: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCategories();
    loadArticles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, searchQuery]);

  const loadCategories = async () => {
    try {
      const result = await api.support.getKbCategories();
      setCategories(result.categories as Category[]);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const loadArticles = async () => {
    try {
      setLoading(true);
      const result = await api.support.getKbArticles({
        categoryId: selectedCategory || undefined,
        published: true,
        search: searchQuery || undefined,
      });
      setArticles(result.articles as Article[]);
    } catch (error) {
      console.error('Failed to load articles:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full">
      <div className="w-1/4 border-r p-4 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Categories</h2>
        <div className="space-y-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`w-full text-left p-2 rounded ${
              selectedCategory === null ? 'bg-blue-100' : 'hover:bg-gray-50'
            }`}
          >
            All Articles
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`w-full text-left p-2 rounded ${
                selectedCategory === category.id ? 'bg-blue-100' : 'hover:bg-gray-50'
              }`}
            >
              {category.name} ({category.article_count})
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search articles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border rounded px-4 py-2"
          />
        </div>
        {loading ? (
          <div>Loading articles...</div>
        ) : (
          <div className="space-y-4">
            {articles.map((article) => (
              <div key={article.id} className="border rounded p-4 hover:bg-gray-50">
                <h3 className="text-lg font-semibold mb-2">{article.title}</h3>
                {article.summary && <p className="text-gray-600 mb-2">{article.summary}</p>}
                <div className="flex justify-between items-center text-sm text-gray-500">
                  <span>{article.view_count} views</span>
                  <span>{article.helpful_count} helpful</span>
                  <span>{new Date(article.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
