import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CustomCalendarProps {
    selectedDate: string;
    onDateSelect: (date: string) => void;
    minDate?: string;
}

const CustomCalendar: React.FC<CustomCalendarProps> = ({ selectedDate, onDateSelect, minDate }) => {
    // Initialize with selectedDate or today
    const [currentMonth, setCurrentMonth] = useState(() => {
        if (selectedDate) return new Date(selectedDate);
        return new Date();
    });

    const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    const getDaysInMonth = (year: number, month: number) => {
        return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (year: number, month: number) => {
        return new Date(year, month, 1).getDay();
    };

    const handlePrevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    const handleDateClick = (day: number) => {
        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        // Adjust for timezone offset to ensure YYYY-MM-DD matches local date
        const offset = date.getTimezoneOffset();
        const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
        onDateSelect(adjustedDate.toISOString().split('T')[0]);
    };

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const todayStr = new Date().toISOString().split('T')[0];

    // Generate grid cells
    const renderCells = () => {
        const cells = [];

        // Empty cells for days before the 1st
        for (let i = 0; i < firstDay; i++) {
            cells.push(<div key={`empty-${i}`} style={{ height: '40px' }}></div>);
        }

        // Day cells
        for (let day = 1; day <= daysInMonth; day++) {
            // const dateObj = new Date(year, month, day); // Unused
            const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

            const isSelected = selectedDate === dateStr;
            const isToday = todayStr === dateStr;
            const isDisabled = !!minDate && dateStr < minDate;

            cells.push(
                <button
                    key={day}
                    onClick={() => !isDisabled && handleDateClick(day)}
                    disabled={isDisabled}
                    style={{
                        height: '40px',
                        width: '100%',
                        borderRadius: '50%',
                        border: 'none',
                        background: isSelected ? '#007d2f' : isToday ? '#fff5f5' : 'transparent',
                        color: isSelected ? '#fff' : isDisabled ? '#ccc' : '#333',
                        fontWeight: isSelected || isToday ? 'bold' : 'normal',
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s',
                        fontSize: '0.9rem'
                    }}
                >
                    {day}
                </button>
            );
        }

        return cells;
    };

    const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    return (
        <div style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '15px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
            border: '1px solid #efefef'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <button
                    onClick={handlePrevMonth}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '5px' }}
                >
                    <ChevronLeft size={20} color="#666" />
                </button>
                <div style={{ fontWeight: 'bold', color: '#00237f', fontSize: '1rem', textTransform: 'capitalize' }}>
                    {monthNames[month]} {year}
                </div>
                <button
                    onClick={handleNextMonth}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '5px' }}
                >
                    <ChevronRight size={20} color="#666" />
                </button>
            </div>

            {/* Days Header */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '10px', textAlign: 'center' }}>
                {daysOfWeek.map(d => (
                    <div key={d} style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#888' }}>
                        {d}
                    </div>
                ))}
            </div>

            {/* Days Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: '5px', columnGap: '2px' }}>
                {renderCells()}
            </div>
        </div>
    );
};

export default CustomCalendar;
