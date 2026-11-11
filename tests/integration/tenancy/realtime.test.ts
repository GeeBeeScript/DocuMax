import { afterAll, beforeAll, expect, it } from "vitest";
import { addMember, cleanup, createOrg, createUser, sleep, waitFor, type TestUser } from "../helpers";

let a: TestUser, b: TestUser, joinA: TestUser, joinB: TestUser;
let orgA: string, orgB: string;

beforeAll(async () => {
  [a, b, joinA, joinB] = await Promise.all(["rt-a", "rt-b", "rt-join-a", "rt-join-b"].map(createUser));
  orgA = (await createOrg(a, "Realtime A")).id;
  orgB = (await createOrg(b, "Realtime B")).id;
});

afterAll(() => cleanup([orgA, orgB], [a, b, joinA, joinB]));

it("user A receives own-org membership events and none from Org B", async () => {
  const received: string[] = [];
  let status = "";
  a.client
    .channel("memberships-iso")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "memberships" }, (payload) => {
      received.push((payload.new as { org_id: string }).org_id);
    })
    .subscribe((s) => (status = s));
  await waitFor(() => status === "SUBSCRIBED");
  // SUBSCRIBED fires before the server has registered the postgres_changes listener.
  await sleep(2_500);

  await addMember(orgB, joinB, "member");
  await addMember(orgA, joinA, "member"); // positive control

  await waitFor(() => received.includes(orgA), 15_000);
  await sleep(1_000); // give any leaked Org B event time to arrive
  expect(received).not.toContain(orgB);
});
