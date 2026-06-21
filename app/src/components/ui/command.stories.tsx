import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command";

export const Palette = () => (
  <Command className="max-w-sm rounded-md border border-border">
    <CommandInput placeholder="Type a command…" />
    <CommandList>
      <CommandEmpty>No results.</CommandEmpty>
      <CommandGroup heading="Workspace">
        <CommandItem>Toggle terminal</CommandItem>
        <CommandItem>New agent session</CommandItem>
        <CommandItem>Open changes</CommandItem>
      </CommandGroup>
    </CommandList>
  </Command>
);
