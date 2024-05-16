import { ComponentLoader, type OverridableComponent } from "adminjs";

import path from "node:path";
import * as url from "node:url";

export const componentLoader = new ComponentLoader();

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
export const add = (componentName: string, url: string): string =>
  componentLoader.add(componentName, path.join(__dirname, url));

export const override = (
  componentName: OverridableComponent,
  url: string,
): string => componentLoader.override(componentName, path.join(__dirname, url));

export const Components = {
  Dashboard: add("Dashboard", "./pages/dashboard.tsx"),
  ApiDocsPage: add("ApiDocsPage", "./pages/api-docs.tsx"),
  StudyDownloadAction: add("StudyDownloadAction", "./StudyDownloadAction.tsx"),
  StudyShowAction: add("StudyShowAction", "./StudyShowAction.tsx"),
  ShowJsonProp: add("ShowJsonProp", "./properties/ShowJsonProp.tsx"),
};
