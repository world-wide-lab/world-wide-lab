import { Box, Label } from "@adminjs/design-system";
import { useEffect } from "react";

import {
  Code,
  CodeHighlightingStyles,
  refreshHighlighting,
} from "../partials/codeHighlighting";

interface GenericObject {
  [key: string]: any;
}

const ShowJsonProp = (props: any) => {
  const { property, record, onChange } = props;

  const object: GenericObject = {};
  // Iterate over all params in the record and get all the start with "<name>."
  const prefix = `${property.name}.`;
  Object.entries(record.params).forEach(([key, value]) => {
    if (key.startsWith(prefix)) {
      object[key.replace(prefix, "")] = value;
    }
  });

  // Pretty print the object
  const formattedObject = JSON.stringify(object, undefined, 2);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Automatic detection of dependencies is not correct
  useEffect(() => {
    refreshHighlighting();
  }, [formattedObject]);

  return (
    <Box mb="xl">
      <Label>{property.label}</Label>
      <CodeHighlightingStyles />
      <pre>
        <Code>{formattedObject}</Code>
      </pre>
    </Box>
  );
};

export default ShowJsonProp;
