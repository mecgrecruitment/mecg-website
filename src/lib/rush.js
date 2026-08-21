// Pure rush business logic, no DB/Prisma dependency, so it's testable with
// node's built-in test runner (see rush.test.js).

/**
 * @param {{ checkinOpensAt: Date, checkinClosesAt: Date }} event
 * @param {Date} now
 */
function isCheckinWindowOpen(event, now) {
  return now >= event.checkinOpensAt && now <= event.checkinClosesAt;
}

module.exports = { isCheckinWindowOpen };
