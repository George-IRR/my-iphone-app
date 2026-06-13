import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useHeatmapData } from '../hooks/useHeatmapData';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts } from '@/constants/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_PADDING = 16;
const CELL_SIZE = (SCREEN_WIDTH - (GRID_PADDING * 2) - (8 * 6)) / 7; // 7 columns, gap of 8

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function HeatmapGrid() {
  const { completionCounts, loading, error, refetch } = useHeatmapData();
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [focusedDay, setFocusedDay] = useState<{ day: number; count: number } | null>(null);

  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();

  // Reset focused day when switching month
  const handleMonthChange = (offset: number) => {
    setSelectedDate(new Date(year, month + offset, 1));
    setFocusedDay(null);
  };

  // Generate calendar days
  const calendarCells = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday, 1 is Monday...

    const cells: (number | null)[] = [];
    
    // Prefix blank spaces for padding
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push(null);
    }
    
    // Actual days in the month
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push(i);
    }
    
    return cells;
  }, [year, month]);

  // Calculate stats for current month
  const monthStats = useMemo(() => {
    let totalCompletions = 0;
    let maxCompletionsInSingleDay = 0;
    let activeDaysCount = 0;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const count = completionCounts[dateStr] || 0;
      if (count > 0) {
        totalCompletions += count;
        activeDaysCount += 1;
        if (count > maxCompletionsInSingleDay) {
          maxCompletionsInSingleDay = count;
        }
      }
    }

    return {
      totalCompletions,
      maxCompletionsInSingleDay,
      activeDaysCount,
    };
  }, [year, month, completionCounts]);

  const getCellDensityColor = (count: number) => {
    if (count === 0) return '#1E1E20';         // Base structure
    if (count <= 2) return '#0B3A1C';          // Low density
    if (count <= 4) return '#156D35';          // Medium density
    return '#2EBD5D';                         // High density
  };

  const handleCellPress = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const count = completionCounts[dateStr] || 0;
    setFocusedDay({ day, count });
  };

  // State handlers for network or storage state bindings:
  if (loading) {
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.loadingText}>Loading execution history logs...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refetch}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Month Navigation Row */}
      <View style={styles.navigationRow}>
        <TouchableOpacity onPress={() => handleMonthChange(-1)} style={styles.navButton}>
          <IconSymbol name="chevron.right" size={20} color="#ECEDEE" style={{ transform: [{ rotate: '180deg' }] }} />
        </TouchableOpacity>
        
        <Text style={styles.monthLabel}>
          {MONTH_NAMES[month]} {year}
        </Text>
        
        <TouchableOpacity onPress={() => handleMonthChange(1)} style={styles.navButton}>
          <IconSymbol name="chevron.right" size={20} color="#ECEDEE" />
        </TouchableOpacity>
      </View>

      {/* Grid Weekday labels */}
      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((day, idx) => (
          <Text key={idx} style={styles.weekdayLabel}>{day}</Text>
        ))}
      </View>

      {/* Grid cells */}
      <View style={styles.gridContainer}>
        {calendarCells.map((day, index) => {
          if (day === null) {
            return <View key={`empty-${index}`} style={styles.emptyCell} />;
          }

          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const count = completionCounts[dateStr] || 0;
          const cellColor = getCellDensityColor(count);
          const isFocused = focusedDay?.day === day;

          return (
            <TouchableOpacity
              key={`day-${day}`}
              activeOpacity={0.8}
              style={[
                styles.cell,
                { backgroundColor: cellColor },
                isFocused && styles.cellFocused,
              ]}
              onPress={() => handleCellPress(day)}
            >
              <Text
                style={[
                  styles.cellText,
                  count > 0 && styles.cellTextWithCompletions,
                ]}
              >
                {day}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Legend */}
      <View style={styles.legendContainer}>
        <Text style={styles.legendLabel}>Less</Text>
        <View style={[styles.legendBox, { backgroundColor: '#1E1E20' }]} />
        <View style={[styles.legendBox, { backgroundColor: '#0B3A1C' }]} />
        <View style={[styles.legendBox, { backgroundColor: '#156D35' }]} />
        <View style={[styles.legendBox, { backgroundColor: '#2EBD5D' }]} />
        <Text style={styles.legendLabel}>More</Text>
      </View>

      {/* Tapped Day Focus Card */}
      {focusedDay && (
        <View style={styles.detailCard}>
          <IconSymbol name="checkmark.circle.fill" size={20} color="#2EBD5D" />
          <View>
            <Text style={styles.detailCardTitle}>
              {MONTH_NAMES[month]} {focusedDay.day}, {year}
            </Text>
            <Text style={styles.detailCardBody}>
              {focusedDay.count === 0
                ? 'No tasks completed on this day.'
                : `${focusedDay.count} task${focusedDay.count > 1 ? 's' : ''} completed!`}
            </Text>
          </View>
        </View>
      )}

      {/* Monthly Stats panel */}
      <View style={styles.statsCard}>
        <Text style={styles.statsCardHeader}>Monthly Insights</Text>
        
        <View style={styles.statsDivider} />
        
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{monthStats.totalCompletions}</Text>
            <Text style={styles.statLabel}>Completions</Text>
          </View>
          
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{monthStats.activeDaysCount}</Text>
            <Text style={styles.statLabel}>Active Days</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statValue}>{monthStats.maxCompletionsInSingleDay}</Text>
            <Text style={styles.statLabel}>Peak Count</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

// Wrap in ScrollView to allow scrolling inside of larger devices

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#151718',
  },
  contentContainer: {
    paddingHorizontal: GRID_PADDING,
    paddingTop: 16,
    paddingBottom: 32,
  },
  stateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#151718',
    padding: 24,
  },
  loadingText: {
    color: '#9BA1A6',
    fontSize: 14,
    fontFamily: Fonts.sans,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: Fonts.sans,
  },
  retryButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  navigationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  navButton: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#1E1E20',
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  monthLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ECEDEE',
    fontFamily: Fonts.rounded,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  weekdayLabel: {
    width: CELL_SIZE,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#687076',
    fontFamily: Fonts.sans,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-start',
    marginBottom: 20,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  emptyCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
  },
  cellFocused: {
    borderColor: '#FFFFFF',
    borderWidth: 1.5,
  },
  cellText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#687076',
    fontFamily: Fonts.mono,
  },
  cellTextWithCompletions: {
    color: '#FFFFFF',
  },
  legendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    marginBottom: 24,
  },
  legendBox: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendLabel: {
    fontSize: 11,
    color: '#687076',
    fontFamily: Fonts.sans,
  },
  detailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(46, 189, 93, 0.1)',
    borderColor: 'rgba(46, 189, 93, 0.3)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  detailCardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ECEDEE',
    fontFamily: Fonts.rounded,
  },
  detailCardBody: {
    fontSize: 12,
    color: '#9BA1A6',
    marginTop: 2,
    fontFamily: Fonts.sans,
  },
  statsCard: {
    backgroundColor: '#1E1E20',
    borderColor: '#2C2C2E',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  statsCardHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ECEDEE',
    fontFamily: Fonts.rounded,
  },
  statsDivider: {
    height: 1,
    backgroundColor: '#2C2C2E',
    marginVertical: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#10B981',
    fontFamily: Fonts.mono,
  },
  statLabel: {
    fontSize: 10,
    color: '#9BA1A6',
    marginTop: 4,
    fontWeight: '600',
    textTransform: 'uppercase',
    fontFamily: Fonts.sans,
  },
});
