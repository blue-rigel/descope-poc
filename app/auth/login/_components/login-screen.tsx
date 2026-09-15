import type { ScreenProps } from "../_lib/types";
import { EditorialScreen } from "./editorial-screen";
import { MinimalScreen } from "./minimal-screen";
import { WorkspaceScreen } from "./workspace-screen";

/** Picks the visual variant selected via the `UiPicker`. */
export function LoginScreen(props: ScreenProps) {
  switch (props.uiOption) {
    case "editorial":
      return <EditorialScreen {...props} />;
    case "workspace":
      return <WorkspaceScreen {...props} />;
    case "minimal":
    default:
      return <MinimalScreen {...props} />;
  }
}
