import assert from 'node:assert/strict';
import { test } from 'node:test';
import { campusDate, defaultSemester, weightedAverage } from '../src/app/shared/academics.ts';
import { csvText } from '../src/app/shared/csv.ts';

test('GWA counts only graded units and uses credit weights', () => {
  const option = grade => ({ grade, label: String(grade), passing: grade <= 3 });
  assert.equal(weightedAverage([
    { scale: option(1.5), units: 3 }, { scale: option(2.25), units: 1 },
    { scale: undefined, units: 5 }, { scale: option(5), units: 0 },
  ]), 1.6875);
  assert.equal(weightedAverage([{ scale: undefined, units: 3 }]), null);
});

test('term selection resolves the campus date before falling back to enrollment history', () => {
  const earlier = { id: 'earlier', start_on: '1900-01-01', end_on: '1900-12-31' };
  const later = { id: 'later', start_on: '2099-01-01', end_on: '2099-12-31' };
  const today = campusDate();
  assert.match(today, /^\d{4}-\d{2}-\d{2}$/);
  const current = { id: 'current', start_on: today, end_on: today };
  assert.equal(defaultSemester([later, earlier, current], ['earlier']), 'current');
  assert.equal(defaultSemester([later, earlier], ['earlier']), 'earlier');
  assert.equal(defaultSemester([later, earlier], []), 'later');
});

test('CSV escaping retains multiline text and prevents spreadsheet formulas', () => {
  assert.equal(csvText([['Normal', 'Quoted "text"', 'with\na newline', null, 0],
    ['=SUM(1,2)', ' @cmd', '-HYPERLINK(1)', 'plain']]),
  `"Normal","Quoted ""text""","with
a newline","","0"\r\n"'=SUM(1,2)","' @cmd","'-HYPERLINK(1)","plain"`);
});
