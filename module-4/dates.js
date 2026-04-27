const dayjs = require('dayjs');

const logDateInfo = (label, dateObj) => {
    console.log(`${label}: ${dateObj.format('YYYY-MM-DD')} (${dateObj.format('dddd')})`);
};

console.log("--- Day.js Date Exercise ---");

const today = dayjs();
logDateInfo("Today", today);

const nextWeek = today.add(7, 'day');
logDateInfo("7 Days Later", nextWeek);

const lastMonth = today.subtract(30, 'day');
logDateInfo("30 Days Ago", lastMonth);