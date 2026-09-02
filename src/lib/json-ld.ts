// JSON-LD is rendered inside a script element. JSON.stringify alone leaves
// `<` intact, so published text containing `</script>` could escape the data
// block and become markup. Escaping these code points preserves the same JSON.
export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}
