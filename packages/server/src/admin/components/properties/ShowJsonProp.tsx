import * as React from "react";
import { Box, Label } from "@adminjs/design-system";

interface GenericObject {
  [key: string]: any;
}

const ShowJsonProp = (props: any) => {
  const { property, record, onChange } = props;

  const object: GenericObject = {};
  // Iterate over all params in the record and get all the start with "<name>."
  const prefix = `${property.name}.`;
  Object.entries(record.params).forEach(([key, value]) => {
    if (key.includes(prefix)) {
      object[key] = value;
    }
  });

  // Pretty print the object
  const formattedObject = JSON.stringify(object, undefined, 2);
  return (
    <Box mb="xl">
      <Label>{property.label}</Label>
      <textarea
        readOnly
        name={property.name}
        cols={30}
        rows={10}
        value={formattedObject}
      ></textarea>
    </Box>
  );
};

export default ShowJsonProp;
