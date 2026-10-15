import { pathToFileURL } from "node:url";

export function summarizePlan(plan) {
  const counts = {
    create: 0,
    update: 0,
    replace: 0,
    delete: 0,
  };

  for (const change of plan.resource_changes ?? []) {
    const actions = change.change?.actions ?? [];
    if (actions.includes("create") && actions.includes("delete")) {
      counts.replace += 1;
    } else if (actions.length === 1 && actions[0] in counts) {
      counts[actions[0]] += 1;
    }
  }

  return [
    "## Saved infrastructure plan",
    "",
    `- Create: ${counts.create}`,
    `- Update: ${counts.update}`,
    `- Replace: ${counts.replace}`,
    `- Delete: ${counts.delete}`,
    "",
    "The saved plan is intentionally not published because it may contain sensitive values.",
  ].join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  console.log(summarizePlan(JSON.parse(input)));
}
