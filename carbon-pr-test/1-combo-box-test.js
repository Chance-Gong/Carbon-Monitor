// Sample from Carbon PR #22425
// Original file: packages/web-components/src/components/combo-box/__tests__/combo-box-test.js
// Status: modified
// Changes: +37/-0

@@ -720,4 +720,41 @@ describe('cds-combo-box', function () {
       expect(el.shadowRoot.textContent).to.contain('Warning text');
     });
   });
+
+  describe('external value clearing', () => {
+    it('should clear input field when value is cleared externally', async () => {
+      const el = await fixture(comboBox({ value: 'option-2' }));
+
+      expect(el.value).to.equal('option-2');
+      expect(getInput(el).value).to.equal('Option 2');
+
+      // Clear value externally (simulating JavaScript manipulation)
+      el.value = '';
+      await waitForUpdates(el);
+
+      expect(el.value).to.equal('');
+      expect(getInput(el).value).to.equal('');
+    });
+
+    it('should clear input field when value is set to empty string externally with allow-custom-value', async () => {
+      const el = await fixture(html`
+        <cds-combo-box
+          title-text="Combo box Label"
+          allow-custom-value
+          value="custom-value">
+          <cds-combo-box-item value="option-1">Option 1</cds-combo-box-item>
+        </cds-combo-box>
+      `);
+
+      expect(el.value).to.equal('custom-value');
+      expect(getInput(el).value).to.equal('custom-value');
+
+      // Clear value externally
+      el.value = '';
+      await waitForUpdates(el);
+
+      expect(el.value).to.equal('');
+      expect(getInput(el).value).to.equal('');
+    });
+  });
 });
