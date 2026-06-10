// Sample from Carbon PR #22425
// Original file: packages/web-components/src/components/combo-box/combo-box.ts
// Status: modified
// Changes: +20/-3

@@ -590,6 +590,18 @@ class CDSComboBox extends CDSDropdown {
     if (!changedProperties.has('value')) {
       return true;
     }
+
+    // Handle when value is cleared externally (empty string, null, or undefined)
+    // Check this BEFORE _selectedItemContent to ensure clearing works
+    if (!this.value) {
+      this._filterInputValue = '';
+      // Directly clear the input if it exists
+      if (this._filterInputNode) {
+        this._filterInputNode.value = '';
+      }
+      return true;
+    }
+
     if (this._selectedItemContent) {
       this._filterInputValue = this._selectedItemContent.textContent || '';
       return true;
@@ -598,9 +610,6 @@ class CDSComboBox extends CDSDropdown {
       this._filterInputValue = String(this.value);
       return true;
     }
-    if (this.value === '') {
-      this._filterInputValue = '';
-    }
     return true;
   }
 
@@ -626,6 +635,14 @@ class CDSComboBox extends CDSDropdown {
 
   updated(changedProperties) {
     super.updated(changedProperties);
+
+    // Handle external value changes to ensure input field syncs
+    if (changedProperties.has('value') && this._filterInputNode) {
+      // Always sync the input field with _filterInputValue when value changes
+      // This ensures the input clears when value is set to empty/null externally
+      this._filterInputNode.value = this._filterInputValue;
+    }
+
     if (changedProperties.has('open')) {
       if (this.open && this._filterInputNode) {
         this._handleInput(changedProperties);
