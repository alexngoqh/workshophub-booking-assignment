// Equivalent of a Claude Code PostToolUse hook: runs prettier after edit/write.
const EXTENSIONS = /\.(jsx?|tsx?|json|css|scss|html|vue|svelte|md|ya?ml|graphql|gql)$/;
export const PrettierOnSave = async ({ $, directory }) => ({
  "tool.execute.after": async (input, output) => {
    if (!["edit", "write"].includes(input.tool)) return;
    const file = output?.args?.filePath ?? input?.args?.filePath;
    if (!file || !EXTENSIONS.test(file) || file.includes("/node_modules/")) return;
    try {
      await $`npx prettier --write ${file}`.cwd(directory).quiet();
    } catch {}
  },
});
