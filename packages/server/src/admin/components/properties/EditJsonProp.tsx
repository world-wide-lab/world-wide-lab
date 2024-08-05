import { Box, Label } from "@adminjs/design-system";
import { useCallback } from "react";

import { Editor, loader } from "@monaco-editor/react";

// Set up monaco without extra download
loader.config({
  paths: {
    vs: "/static/monaco-editor/vs",
  },
});

interface GenericObject {
  [key: string]: any;
}

const ShowJsonProp = (props: any) => {
  const { property, record, onChange } = props;

  const object: GenericObject = {};
  // Iterate over all params in the record and get all the start with "<name>."
  const prefix = `${property.name}.`;
  let hasKeys = false;
  for (const [key, value] of Object.entries(record.params)) {
    if (key.startsWith(prefix)) {
      hasKeys = true;
      object[key.replace(prefix, "")] = value;
    }
  }

  // Pretty print the object
  const defaultValue = hasKeys
    ? JSON.stringify(object, undefined, 2)
    : property.custom.defaultValue || "";

  // biome-ignore lint/correctness/useExhaustiveDependencies: Implementation copied from AdminJS
  const handleUpdate = useCallback((newValue: string | undefined, ev: any) => {
    onChange(property.path, newValue);
  }, []);

  return (
    <Box mb="xl">
      <Label>{property.label}</Label>
      <Editor
        options={{ minimap: { enabled: false } }}
        onChange={handleUpdate}
        defaultValue={defaultValue}
        theme="vs-dark"
        defaultLanguage="json"
        height="8em"
      />
    </Box>
  );
};

export default ShowJsonProp;
