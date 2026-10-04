// src/server/api/hello.ts
import { defineEventHandler } from "solid-vue/server";
var hello_default = defineEventHandler(() => {
  return {
    message: "Backend Solid-Vue Sampurna Jalan! \u{1F680}"
  };
});
export {
  hello_default as default
};
