/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
declare const __FD_LINKS__: import('@/app/links').FdLinks;

declare module 'virtual:licences' {
  export const LICENCES: { name: string; version: string; licence: string }[];
  export const LICENCE_FILE: string;
}
