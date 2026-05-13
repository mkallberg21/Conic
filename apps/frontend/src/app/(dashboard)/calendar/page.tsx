'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

type EventType = 'deliverable' | 'payment' | 'appearance' | 'campaign' | 'task' | 'milestone';

interface CalendarEvent {
  id: string;
  type: EventType;
  title: string;
  date: string;
  status: string;
  entityType: string;
  metadata?: Record<string, unknown>;
}

const EVENT_COLORS: Record<EventType, string> = {
  deliverable: 'bg-blue-100 text-blue-700 border-blue-200',
  payment: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  milestone: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  appearance: 'bg-purple-100 text-purple-700 border-purple-200',
  campaign: 'bg-orange-100 text-orange-700 border-orange-200',
  task: 'bg-gray-100 text-gray-700 border-gray-200',
};

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function isoDate(d: Date) {
  return d.toISOString().split('T')[0];
}

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59);

  const { data: events = [] } = useQuery<CalendarEvent[]>({
    queryKey: ['calendar', year, month],
    queryFn: () =>
      api.get(`/v1/calendar?start=${isoDate(startDate)}&end=${isoDate(endDate)}`).then((r) => r.data),
  });

  // Group events by date string YYYY-MM-DD
  const byDay = events.reduce<Record<string, CalendarEvent[]>>((acc, ev) => {
    const key = ev.date.split('T')[0];
    (acc[key] ??= []).push(ev);
    return acc;
  }, {});

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
    setSelectedDay(null);
  };

  // Build grid: days in month + leading blank cells
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [
    ...Array<null>(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const selectedEvents = selectedDay ? (byDay[selectedDay] ?? []) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Content Calendar</h1>
        <p className="text-muted-foreground">Deliverables, payments, appearances, and campaigns in one view</p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-xs">
        {(Object.entries(EVENT_COLORS) as [EventType, string][]).map(([type, cls]) => (
          <span key={type} className={`px-2 py-0.5 rounded border ${cls}`}>{type}</span>
        ))}
      </div>

      {/* Calendar grid */}
      <Card>
        <CardContent className="pt-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="font-semibold text-lg">{MONTHS[month]} {year}</h2>
            <Button variant="ghost" size="icon" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Day labels */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
            ))}
          </div>

          {/* Cells */}
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {cells.map((day, idx) => {
              if (day === null) return <div key={`blank-${idx}`} className="bg-background min-h-[80px]" />;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayEvents = byDay[dateStr] ?? [];
              const isToday = dateStr === isoDate(today);
              const isSelected = dateStr === selectedDay;

              return (
                <div
                  key={dateStr}
                  onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                  className={`bg-background min-h-[80px] p-1 cursor-pointer hover:bg-muted/50 transition-colors ${isSelected ? 'ring-2 ring-inset ring-primary' : ''}`}
                >
                  <span className={`text-xs font-medium inline-flex h-5 w-5 items-center justify-center rounded-full ${isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'}`}>
                    {day}
                  </span>
                  <div className="mt-0.5 space-y-0.5">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <div
                        key={ev.id}
                        className={`text-[10px] truncate rounded px-1 border ${EVENT_COLORS[ev.type]}`}
                      >
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-muted-foreground pl-1">+{dayEvents.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected day events */}
      {selectedDay && (
        <Card>
          <CardContent className="pt-4">
            <h3 className="font-semibold mb-3">
              {new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h3>
            {selectedEvents.length === 0 ? (
              <p className="text-muted-foreground text-sm">No events on this day.</p>
            ) : (
              <div className="space-y-2">
                {selectedEvents.map((ev) => (
                  <div key={ev.id} className="flex items-start gap-3 py-2 border-b last:border-0">
                    <Badge
                      variant="outline"
                      className={`text-[10px] capitalize shrink-0 ${EVENT_COLORS[ev.type]}`}
                    >
                      {ev.type}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{ev.title}</p>
                      <p className="text-xs text-muted-foreground">{ev.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
