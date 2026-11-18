// Equivalent of a Claude Code PreToolUse hook: blocks `git push` to main.
export const BlockPushToMain = async () => ({
  "tool.execute.before": async (input, output) => {
    if (input.tool !== "bash") return;
    const cmd = output.args?.command ?? "";
    if (/\bgit\s+push\b/.test(cmd) && /(^|[^\w-])main([^\w-]|$)/.test(cmd)) {
      throw new Error("Direct push to main branch is forbidden. Push a feature branch and open a PR.");
    }
  },
});
