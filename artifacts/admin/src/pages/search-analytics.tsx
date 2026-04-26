import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search, TrendingUp, Eye, Heart, ShoppingCart, Star,
  RefreshCw, BarChart2, Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, CartesianGrid,
} from "recharts";

import { apiAbsoluteFetch } from "@/lib/api";

async function apiFetch(path: string) {
  return apiAbsoluteFetch(`/api${path}`);
}

type TrendingProduct = {
  id: string;
  name: string;
  price: number;
  category?: string;
  image?: string;
  rating?: number;
  vendorName?: string;
  score?: number;
  reason?: string;
};

type StatsData = {
  productCount?: number;
  restaurantCount?: number;
  userCount?: number;
  orderCount?: number;
};

const INTERACTION_COLORS: Record<string, string> = {
  view: "text-blue-600 bg-blue-50",
  wishlist: "text-pink-600 bg-pink-50",
  cart: "text-purple-600 bg-purple-50",
  purchase: "text-green-600 bg-green-50",
  rating: "text-amber-600 bg-amber-50",
  trending: "text-orange-600 bg-orange-50",
};

const CHART_COLORS = [
  "#f59e0b", "#6366f1", "#10b981", "#f43f5e", "#3b82f6",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#84cc16",
];

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: string | number; icon: React.ElementType; color: string;
}) {
  const bg = color.includes("blue") ? "bg-blue-50 border-blue-100"
    : color.includes("green") ? "bg-green-50 border-green-100"
    : color.includes("purple") ? "bg-purple-50 border-purple-100"
    : "bg-amber-50 border-amber-100";
  return (
    <div className={cn("rounded-2xl border p-4 flex items-center gap-3", bg)}>
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

function ChartCard({ title, icon: Icon, iconBg, children }: {
  title: string; icon: React.ElementType; iconBg: string; children: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl shadow-sm overflow-hidden">
      <div className={cn("flex items-center gap-2 px-4 py-3 border-b", iconBg)}>
        <Icon className="w-4 h-4" />
        <span className="font-semibold text-sm text-gray-800">{title}</span>
      </div>
      <CardContent className="p-4">{children}</CardContent>
    </Card>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-bold text-gray-800 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{typeof p.value === "number" ? Math.round(p.value) : p.value}</span>
        </p>
      ))}
    </div>
  );
};

export default function SearchAnalyticsPage() {
  const [trendingPeriod, setTrendingPeriod] = useState("7d");

  const { data: trendingData, isLoading: trendLoading, refetch: refetchTrending } = useQuery<{ products: TrendingProduct[] }>({
    queryKey: ["admin-trending-products", trendingPeriod],
    queryFn: () => apiFetch(`/recommendations/trending?limit=20&days=${trendingPeriod.replace("d", "")}`),
    staleTime: 5 * 60_000,
  });

  const { data: trendingSearchData, isLoading: searchLoading } = useQuery<{ terms: string[] } | { searches: string[] }>({
    queryKey: ["admin-trending-searches"],
    queryFn: () => apiFetch("/products/trending-searches?limit=20"),
    staleTime: 5 * 60_000,
  });

  const { data: statsData, isLoading: statsLoading } = useQuery<StatsData>({
    queryKey: ["admin-platform-stats"],
    queryFn: () => apiFetch("/stats/public"),
    staleTime: 5 * 60_000,
  });

  const trending: TrendingProduct[] = trendingData?.products ?? [];
  const rawTerms = (trendingSearchData as any);
  const searchTerms: string[] = Array.isArray(rawTerms?.terms) ? rawTerms.terms
    : Array.isArray(rawTerms?.searches) ? rawTerms.searches
    : Array.isArray(rawTerms) ? rawTerms
    : [];

  // Build bar chart data: rank-based relative popularity (no raw counts from API)
  const searchChartData = searchTerms.slice(0, 12).map((term, i) => ({
    term: term.length > 14 ? term.slice(0, 12) + "…" : term,
    fullTerm: term,
    score: Math.round(100 * Math.pow(0.82, i)),
  }));

  // Trending products chart: use real score values
  const productChartData = trending.slice(0, 10).map(p => ({
    name: p.name.length > 14 ? p.name.slice(0, 12) + "…" : p.name,
    fullName: p.name,
    score: p.score !== undefined ? Math.round(p.score) : 0,
  }));

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart2 className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-gray-900">Search & Engagement Analytics</h1>
          </div>
          <p className="text-sm text-gray-500">What customers are searching, viewing, and engaging with most</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetchTrending()} className="h-8 rounded-xl gap-1">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Products" value={statsLoading ? "…" : statsData?.productCount?.toLocaleString() ?? "—"} icon={Package} color="text-blue-600" />
        <StatCard label="Restaurants" value={statsLoading ? "…" : statsData?.restaurantCount?.toLocaleString() ?? "—"} icon={TrendingUp} color="text-green-600" />
        <StatCard label="Trending Items" value={trending.length} icon={TrendingUp} color="text-purple-600" />
        <StatCard label="Search Terms" value={searchTerms.length} icon={Search} color="text-amber-600" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Search Terms Bar Chart */}
        <ChartCard title="Top Search Terms" icon={Search} iconBg="bg-gradient-to-r from-orange-50 to-amber-50">
          {searchLoading ? (
            <div className="flex items-center justify-center h-52 text-gray-400 text-sm animate-pulse">Loading…</div>
          ) : searchChartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-52 text-gray-400 gap-2">
              <Search className="w-8 h-8 opacity-20" />
              <p className="text-sm">No search data yet</p>
            </div>
          ) : (
            <>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={searchChartData} layout="vertical" margin={{ top: 0, right: 20, left: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                    <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}`}
                      tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="term" width={80}
                      tick={{ fontSize: 10, fill: "#374151" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f9fafb" }} />
                    <Bar dataKey="score" name="Popularity" radius={[0, 6, 6, 0]} barSize={14}>
                      {searchChartData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[10px] text-gray-400 text-right mt-1">Relative popularity score based on search rank</p>
            </>
          )}
        </ChartCard>

        {/* Trending Product Scores Bar Chart */}
        <ChartCard title="Trending Product Scores" icon={TrendingUp} iconBg="bg-gradient-to-r from-purple-50 to-indigo-50">
          <div className="flex items-center justify-between mb-3 -mt-1">
            <span />
            <Select value={trendingPeriod} onValueChange={setTrendingPeriod}>
              <SelectTrigger className="h-7 w-20 text-xs rounded-lg border-gray-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">Today</SelectItem>
                <SelectItem value="7d">7 days</SelectItem>
                <SelectItem value="30d">30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {trendLoading ? (
            <div className="flex items-center justify-center h-44 text-gray-400 text-sm animate-pulse">Loading…</div>
          ) : productChartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-44 text-gray-400 gap-2">
              <Package className="w-8 h-8 opacity-20" />
              <p className="text-sm">No trending data yet</p>
            </div>
          ) : (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productChartData} margin={{ top: 4, right: 4, left: 0, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#374151" }}
                    axisLine={false} tickLine={false} angle={-30} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f5f3ff" }} />
                  <Bar dataKey="score" name="Score" radius={[6, 6, 0, 0]} barSize={20}>
                    {productChartData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Ranked lists */}
      <div className="grid md:grid-cols-2 gap-5">
        {/* Trending Search Terms List */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-orange-50 to-amber-50">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-orange-600" />
              <span className="font-semibold text-sm text-gray-800">Trending Searches</span>
            </div>
            <Badge variant="secondary" className="text-xs">{searchTerms.length}</Badge>
          </div>
          <div className="p-3">
            {searchLoading ? (
              <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Loading…</div>
            ) : searchTerms.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-400 gap-2">
                <Search className="w-8 h-8 opacity-20" />
                <p className="text-sm">No search data yet</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {searchTerms.slice(0, 15).map((term, i) => (
                  <div key={term} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors">
                    <span className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                      i === 0 ? "bg-amber-100 text-amber-700"
                        : i === 1 ? "bg-gray-100 text-gray-600"
                        : i === 2 ? "bg-orange-100 text-orange-700"
                        : "bg-gray-50 text-gray-400"
                    )}>
                      {i + 1}
                    </span>
                    <span className="flex-1 text-sm text-gray-700 truncate">{term}</span>
                    <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-400"
                        style={{ width: `${Math.round(100 * Math.pow(0.82, i))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Trending Products List */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-purple-50 to-indigo-50">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-600" />
              <span className="font-semibold text-sm text-gray-800">Trending Products</span>
            </div>
            <Select value={trendingPeriod} onValueChange={setTrendingPeriod}>
              <SelectTrigger className="h-7 w-20 text-xs rounded-lg border-gray-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">Today</SelectItem>
                <SelectItem value="7d">7 days</SelectItem>
                <SelectItem value="30d">30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="p-3">
            {trendLoading ? (
              <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Loading…</div>
            ) : trending.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-400 gap-2">
                <Package className="w-8 h-8 opacity-20" />
                <p className="text-sm">No trending data yet</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {trending.slice(0, 10).map((product, i) => (
                  <div key={product.id} className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-50 transition-colors">
                    <span className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                      i === 0 ? "bg-purple-100 text-purple-700"
                        : i === 1 ? "bg-indigo-100 text-indigo-700"
                        : i === 2 ? "bg-blue-100 text-blue-700"
                        : "bg-gray-50 text-gray-400"
                    )}>
                      {i + 1}
                    </span>
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="w-8 h-8 rounded-lg object-cover shrink-0 border" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{product.name}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {product.vendorName && `${product.vendorName} · `}Rs. {product.price?.toLocaleString()}
                      </p>
                    </div>
                    {product.score !== undefined && (
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        {Math.round(product.score)} pts
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Engagement Guide */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b bg-gradient-to-r from-teal-50 to-green-50">
          <Eye className="w-4 h-4 text-teal-600" />
          <span className="font-semibold text-sm text-gray-800">Customer Engagement Guide</span>
        </div>
        <div className="p-4 grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { type: "view",      label: "Product Views",   desc: "How many times products are opened and viewed by customers",        icon: Eye },
            { type: "wishlist",  label: "Wishlist Adds",   desc: "Products customers save to view later — shows purchase intent",     icon: Heart },
            { type: "cart",      label: "Cart Adds",       desc: "Products added to cart — high conversion intent",                  icon: ShoppingCart },
            { type: "trending",  label: "Trending Score",  desc: "Combined score based on views, cart adds, and purchases",          icon: TrendingUp },
            { type: "rating",    label: "Product Ratings", desc: "Customer satisfaction signals from product reviews",               icon: Star },
            { type: "purchase",  label: "Conversions",     desc: "Products that led to completed orders",                           icon: ShoppingCart },
          ].map(item => {
            const Icon = item.icon;
            const colorClass = INTERACTION_COLORS[item.type] || "text-gray-600 bg-gray-50";
            return (
              <div key={item.type} className="flex gap-3 items-start p-3 rounded-xl bg-gray-50 border border-gray-100">
                <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0", colorClass)}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{item.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
