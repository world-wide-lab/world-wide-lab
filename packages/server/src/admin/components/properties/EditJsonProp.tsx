import { Box, Icon, Label } from "@adminjs/design-system";
import { useCallback, useState } from "react";

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

  const [jsonStatus, setJsonStatus] = useState<string>("");
  // biome-ignore lint/correctness/useExhaustiveDependencies: Implementation copied from AdminJS
  const handleUpdate = useCallback((newValue: string | undefined, ev: any) => {
    try {
      // @ts-ignore
      const parsedNewValue = JSON.parse(newValue);
      onChange(property.path, parsedNewValue);
      setJsonStatus("success");
    } catch (err) {
      // Do nothing
      setJsonStatus("error");
    }
  }, []);

  return (
    <Box mb="xl">
      <Label>
        {property.label}
        &nbsp;
        <Icon
          icon={
            jsonStatus === "error"
              ? "XCircle"
              : jsonStatus === "success"
                ? "CheckCircle"
                : "Circle"
          }
          title={
            jsonStatus === "error"
              ? "Error: Invalid JSON."
              : jsonStatus === "success"
                ? "JSON saved successfully."
                : "This circle indicates whether the JSON was saved successfully."
          }
          style={{ opacity: 0.5 }}
        />
      </Label>
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
