import assert from "node:assert/strict";
import { afterEach, test } from "vitest";
import { SyncWorkerPool, workerCount } from "../../src/lib/syncWorkerPool.ts";

const worker = new URL("../fixtures/syncPoolWorker.ts", import.meta.url);
const pools: SyncWorkerPool<number, number>[] = [];
const start = (size: number) => {
	const pool = new SyncWorkerPool<number, number>(worker, size, {
		offset: 1,
	});
	pools.push(pool);
	return pool;
};
afterEach(() => {
	for (const pool of pools.splice(0)) pool.close();
});

test("each ticket gives its own job's result, whatever order they are taken in", () => {
	const pool = start(3);
	const tickets = Array.from({ length: 40 }, (_, job) => pool.submit(job));
	for (const ticket of [...tickets].reverse())
		assert.equal(pool.take(ticket), ticket * 2 + 1);
});

test("a job that throws surfaces its message and leaves the pool working", () => {
	const pool = start(2);
	const bad = pool.submit(-3);
	const good = pool.submit(5);
	assert.throws(() => pool.take(bad), /Job -3 is refused/);
	assert.equal(pool.take(good), 11);
	assert.equal(pool.take(pool.submit(6)), 13);
});

test("worker count follows the environment, else the cores, within a limit", () => {
	const name = "SYNC_POOL_TEST_WORKERS";
	delete process.env[name];
	assert.equal(workerCount(name, 4, 16), 4);
	assert.equal(workerCount(name, 4, 3), 2);
	assert.equal(workerCount(name, 4, 1), 1);
	process.env[name] = "7";
	assert.equal(workerCount(name, 4, 16), 7);
	process.env[name] = "0";
	assert.equal(workerCount(name, 4, 16), 4);
	process.env[name] = "many";
	assert.equal(workerCount(name, 4, 16), 4);
	delete process.env[name];
});
