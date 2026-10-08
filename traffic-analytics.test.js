const test = require("node:test");
const assert = require("node:assert/strict");
const {
    createTrafficState,
    restoreTrafficState,
    recordTrafficVisit,
    recordProductClick,
    getTrafficInsights
} = require("./traffic-analytics");

test("counts views and unique visitors using Vietnam calendar days", () => {
    const now = new Date("2026-10-07T18:00:00Z");
    const state = createTrafficState(now);
    recordTrafficVisit(state, "browser-one", now);
    recordTrafficVisit(state, "browser-one", now);
    recordTrafficVisit(state, "browser-two", now);
    recordTrafficVisit(state, "browser-one", new Date("2026-10-08T18:00:00Z"));

    const result = getTrafficInsights(state, 7, new Date("2026-10-08T18:00:00Z"));
    assert.equal(result.totalViews, 4);
    assert.equal(result.uniqueVisitors, 2);
    assert.equal(result.todayViews, 1);
    assert.equal(result.daily.at(-1).date, "2026-10-09");
    assert.equal(JSON.stringify(state).includes("browser-one"), false);
    assert.equal(JSON.stringify(result).includes(state.daily["2026-10-08"].visitors[0]), false);
});

test("retains 90 days, restores state and rejects invalid ranges", () => {
    const state = createTrafficState();
    recordTrafficVisit(state, "old-browser", new Date("2026-07-09T00:00:00Z"));
    recordTrafficVisit(state, "boundary-browser", new Date("2026-07-10T00:00:00Z"));
    recordTrafficVisit(state, "today-browser", new Date("2026-10-07T00:00:00Z"));

    assert.equal(state.daily["2026-07-09"], undefined);
    const result = getTrafficInsights(state, 90, new Date("2026-10-07T00:00:00Z"));
    assert.equal(result.daily.length, 90);
    assert.equal(result.daily[0].date, "2026-07-10");
    assert.equal(result.totalViews, 2);
    assert.deepEqual(restoreTrafficState(JSON.parse(JSON.stringify(state))), state);
    assert.deepEqual(restoreTrafficState(undefined).daily, {});
    assert.throws(() => restoreTrafficState({ startedAt: "invalid", daily: {} }), /Invalid/);
    assert.throws(() => getTrafficInsights(state, 0), /Invalid/);
});

test("aggregates orders and ranks product clicks in a custom date range", () => {
    const now = new Date("2026-10-07T12:00:00Z");
    const state = createTrafficState(now);
    recordTrafficVisit(state, "browser-one", new Date("2026-10-01T00:00:00Z"));
    recordProductClick(state, { id: 1, name: "Linen", sku: "LINEN-1" }, now);
    recordProductClick(state, { id: 1, name: "Linen", sku: "LINEN-1" }, now);
    recordProductClick(state, { id: 2, name: "Cotton", sku: "COTTON-1" }, now);

    const result = getTrafficInsights(state, {
        startDate: "2026-10-01",
        endDate: "2026-10-07"
    }, now, [
        { createdAt: "2026-09-30T17:00:00Z" },
        { createdAt: "2026-10-03T16:59:59Z" },
        { createdAt: "bad" }
    ]);
    assert.equal(result.totalOrders, 2);
    assert.equal(result.undatedOrders, 1);
    assert.equal(result.uniqueVisitors, 1);
    assert.deepEqual(result.topProductClicks.map(({ productId, clicks }) => [productId, clicks]), [[1, 2], [2, 1]]);
    assert.throws(() => getTrafficInsights(state, {
        startDate: "2026-10-08",
        endDate: "2026-10-09"
    }, now), RangeError);
});
