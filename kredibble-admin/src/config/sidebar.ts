/**
 * Sidebar preference storage. Lives in a plain module (not in the "use client"
 * shell) because the SERVER layout also needs the cookie name: a server
 * component that imports a value from a client module only receives a
 * client reference, not the string.
 */
export const SIDEBAR_COOKIE = "sidebar";
export type SidebarPreference = "expanded" | "collapsed";
