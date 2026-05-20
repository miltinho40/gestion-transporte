export const serializeResponse = (value: unknown) => {
  return JSON.parse(
    JSON.stringify(value, (_key, innerValue) => {
      if (typeof innerValue === 'bigint') {
        return innerValue.toString();
      }

      return innerValue;
    })
  );
};
