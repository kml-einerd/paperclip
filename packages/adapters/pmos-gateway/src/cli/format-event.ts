import pc from "picocolors";

export function printPmosGatewayStreamEvent(raw: string, debug: boolean): void {
  const line = raw.trim();
  if (!line) return;

  if (!debug) {
    console.log(line);
    return;
  }

  if (line.startsWith("[pmos-gateway:event]")) {
    console.log(pc.cyan(line));
    return;
  }

  if (line.startsWith("[pmos-gateway]")) {
    console.log(pc.blue(line));
    return;
  }

  console.log(pc.gray(line));
}
