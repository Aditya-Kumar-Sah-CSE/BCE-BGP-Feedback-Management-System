'use client';

import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { ParameterMetrics, OverallDistribution, FacultyComparisonItem } from '@/lib/analytics/types';

interface ParameterChartProps {
  parameters: ParameterMetrics[];
  hasData: boolean;
}

const RATING_COLORS = {
  excellent: '#6366F1', // Indigo 500
  veryGood: '#10B981', // Emerald 500
  good: '#3B82F6', // Blue 500
  satisfactory: '#F59E0B', // Amber 500
  unsatisfactory: '#EF4444', // Red 500
};

/**
 * Parameter-wise Average Score Bar Chart (1.00 to 5.00)
 */
export function ParameterScoreBarChart({ parameters, hasData }: ParameterChartProps) {
  if (!hasData || parameters.every(p => p.validCount === 0)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-slate-900/40 rounded-xl border border-slate-800 p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-500 mb-3">
          📊
        </div>
        <p className="text-sm font-semibold text-slate-300">No Feedback Responses Available</p>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Parameter ratings will be charted automatically once real student responses are synchronized.
        </p>
      </div>
    );
  }

  const data = parameters.map(p => ({
    name: p.title.length > 18 ? `${p.title.slice(0, 16)}…` : p.title,
    fullName: `${p.parameterId}. ${p.title}`,
    score: p.averageScore,
    validCount: p.validCount,
  }));

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 5]}
            ticks={[0, 1, 2, 3, 4, 5]}
            stroke="#94A3B8"
            fontSize={12}
            tickFormatter={val => `${val}.0`}
          />
          <YAxis
            type="category"
            dataKey="name"
            stroke="#94A3B8"
            fontSize={12}
            width={130}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload;
                return (
                  <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl text-xs">
                    <p className="font-semibold text-white mb-1">{item.fullName}</p>
                    <p className="text-emerald-400">
                      Average Score:{' '}
                      <span className="font-bold text-white">{item.score.toFixed(2)} / 5.00</span>
                    </p>
                    <p className="text-slate-400 mt-1">Valid Responses: {item.validCount}</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={18}>
            {data.map((entry, index) => {
              const color =
                entry.score >= 4.0
                  ? RATING_COLORS.excellent
                  : entry.score >= 3.0
                  ? RATING_COLORS.veryGood
                  : entry.score >= 2.0
                  ? RATING_COLORS.satisfactory
                  : RATING_COLORS.unsatisfactory;
              return <Cell key={`cell-${index}`} fill={color} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * 8-Parameter Breakdown Stacked Percentage Chart
 */
export function ParameterDistributionStackedChart({
  parameters,
  hasData,
}: ParameterChartProps) {
  if (!hasData || parameters.every(p => p.validCount === 0)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-slate-900/40 rounded-xl border border-slate-800 p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-500 mb-3">
          📈
        </div>
        <p className="text-sm font-semibold text-slate-300">Distribution Pending Real Responses</p>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          A stacked distribution of rating tiers across all parameters will appear here.
        </p>
      </div>
    );
  }

  const data = parameters.map(p => ({
    name: p.title.length > 16 ? `${p.title.slice(0, 14)}…` : p.title,
    fullName: `${p.parameterId}. ${p.title}`,
    Excellent: p.excellentPct,
    'Very Good': p.veryGoodPct,
    Good: p.goodPct,
    Satisfactory: p.satisfactoryPct,
    Unsatisfactory: p.unsatisfactoryPct,
    totalValid: p.validCount,
  }));

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 20, right: 20, left: -10, bottom: 25 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
          <XAxis
            dataKey="name"
            stroke="#94A3B8"
            fontSize={11}
            angle={-20}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            domain={[0, 100]}
            stroke="#94A3B8"
            fontSize={12}
            tickFormatter={val => `${val}%`}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                const item = data.find(d => d.name === label);
                return (
                  <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl text-xs space-y-1">
                    <p className="font-semibold text-white border-b border-slate-800 pb-1">
                      {item?.fullName || label}
                    </p>
                    <p className="text-indigo-400">
                      Excellent: <span className="font-semibold">{item?.Excellent}%</span>
                    </p>
                    <p className="text-emerald-400">
                      Very Good: <span className="font-semibold">{item?.['Very Good']}%</span>
                    </p>
                    <p className="text-blue-400">
                      Good: <span className="font-semibold">{item?.Good}%</span>
                    </p>
                    <p className="text-amber-400">
                      Satisfactory: <span className="font-semibold">{item?.Satisfactory}%</span>
                    </p>
                    <p className="text-red-400">
                      Unsatisfactory: <span className="font-semibold">{item?.Unsatisfactory}%</span>
                    </p>
                    <p className="text-slate-400 pt-1 border-t border-slate-800">
                      Total Valid: {item?.totalValid}
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend
            verticalAlign="top"
            wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }}
          />
          <Bar dataKey="Excellent" stackId="a" fill={RATING_COLORS.excellent} />
          <Bar dataKey="Very Good" stackId="a" fill={RATING_COLORS.veryGood} />
          <Bar dataKey="Good" stackId="a" fill={RATING_COLORS.good} />
          <Bar dataKey="Satisfactory" stackId="a" fill={RATING_COLORS.satisfactory} />
          <Bar dataKey="Unsatisfactory" stackId="a" fill={RATING_COLORS.unsatisfactory} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Overall Distribution Donut Chart
 */
export function OverallDonutChart({
  distribution,
  hasData,
}: {
  distribution: OverallDistribution;
  hasData: boolean;
}) {
  if (!hasData || distribution.totalValidRatings === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-slate-900/40 rounded-xl border border-slate-800 p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-500 mb-3">
          🍩
        </div>
        <p className="text-sm font-semibold text-slate-300">No Ratings Recorded</p>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Rating breakdown across all questions will appear here.
        </p>
      </div>
    );
  }

  const pieData = [
    { name: 'Excellent', value: distribution.excellentCount, pct: distribution.excellentPct, color: RATING_COLORS.excellent },
    { name: 'Very Good', value: distribution.veryGoodCount, pct: distribution.veryGoodPct, color: RATING_COLORS.veryGood },
    { name: 'Good', value: distribution.goodCount, pct: distribution.goodPct, color: RATING_COLORS.good },
    { name: 'Satisfactory', value: distribution.satisfactoryCount, pct: distribution.satisfactoryPct, color: RATING_COLORS.satisfactory },
    { name: 'Unsatisfactory', value: distribution.unsatisfactoryCount, pct: distribution.unsatisfactoryPct, color: RATING_COLORS.unsatisfactory },
  ].filter(d => d.value > 0);

  return (
    <div className="w-full h-64 flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={3}
            dataKey="value"
          >
            {pieData.map((entry, index) => (
              <Cell key={`donut-cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload;
                return (
                  <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-lg shadow-xl text-xs">
                    <p className="font-semibold text-white">{item.name}</p>
                    <p className="text-slate-300">
                      Count: <span className="font-bold text-white">{item.value}</span> ({item.pct}%)
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value, entry: any) => (
              <span className="text-xs text-slate-300">
                {value} ({entry.payload.pct}%)
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Faculty Comparison Bar Chart (Aggregated Scope View)
 */
export function FacultyComparisonBarChart({
  comparisons,
}: {
  comparisons: FacultyComparisonItem[];
}) {
  if (!comparisons || comparisons.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-slate-900/40 rounded-xl border border-slate-800 p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-500 mb-3">
          👥
        </div>
        <p className="text-sm font-semibold text-slate-300">No Comparative Faculty Data</p>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Comparative benchmarks will appear when two or more faculty feedback forms in this scope have recorded responses.
        </p>
      </div>
    );
  }

  const data = comparisons.slice(0, 10).map(c => ({
    name: c.facultyName.length > 15 ? `${c.facultyName.slice(0, 13)}…` : c.facultyName,
    fullName: c.facultyName,
    subject: `${c.subjectName} (${c.subjectCode})`,
    score: c.averageScore,
    responses: c.responseCount,
  }));

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 30, left: -10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
          <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} interval={0} />
          <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} stroke="#94A3B8" fontSize={12} />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload;
                return (
                  <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl text-xs space-y-1">
                    <p className="font-semibold text-white">{item.fullName}</p>
                    <p className="text-slate-400">{item.subject}</p>
                    <p className="text-emerald-400">
                      Average Rating: <span className="font-bold text-white">{item.score.toFixed(2)} / 5.00</span>
                    </p>
                    <p className="text-slate-400">Valid Submissions: {item.responses}</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey="score" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={28}>
            {data.map((entry, index) => {
              const color =
                entry.score >= 4.0
                  ? RATING_COLORS.excellent
                  : entry.score >= 3.0
                  ? RATING_COLORS.veryGood
                  : entry.score >= 2.0
                  ? RATING_COLORS.satisfactory
                  : RATING_COLORS.unsatisfactory;
              return <Cell key={`comp-cell-${index}`} fill={color} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
