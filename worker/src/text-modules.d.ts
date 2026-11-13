// Types for .md prompt imports (Text rule in wrangler.jsonc)
declare module "*.md" {
  const text: string;
  export default text;
}
