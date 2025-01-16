const daysPerCycle = 28;
const base = new Date(Date.UTC(1901, 0, 10));
const millisPerDay = 24 * 60 * 60 * 1000;
const millisPerCycle = daysPerCycle * millisPerDay;

const airacGetIdentifier = (date) => {

  const baseMillis = base.getTime();
  const dateMillis = date.getTime();

  const serial = Math.floor((dateMillis - baseMillis) / millisPerCycle);
  const effectiveStart = new Date(base.getTime() + (serial * millisPerCycle))
  const year = effectiveStart.getFullYear();

  const yearStartMillis = new Date(Date.UTC(year, 0, 1));
  const yearMillis = effectiveStart.getTime() - yearStartMillis.getTime();
  const ordinal = Math.floor(yearMillis / millisPerCycle) + 1;

  const yearPart = (year % 100).toString().padStart(2, "0");
  const ordinalPart = ordinal.toString().padStart(2, "0");

  return `${yearPart}${ordinalPart}`
}

module.exports = airacGetIdentifier;
