import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-example',
  standalone: true,
  template: `
    <div class="container mx-auto p-8">
      <!-- This is a test comment -->
      <h1 class="text-4xl font-bold mb-4">Nexus-Eye Test Page</h1>
      
      <p class="text-slate-500 mb-8">
        This line contains plain inner text that should be Radiant White.
      </p>

      @if (loading()) {
        <div class="flex items-center space-x-4">
          <app-spinner [size]="'large'" (reset)="onReset()" />
          <span>Synchronizing with Nexus...</span>
        </div>
      } @else {
        <ul class="grid gap-4">
          @for (item of items(); track item.id) {
            <li class="p-4 border border-slate-800 rounded-xl">
              <span class="text-emerald-400">{{ item.name }}</span>
              <button [disabled]="item.locked" (click)="select(item.id)">
                View Record Details
              </button>
            </li>
          } @empty {
            <p>No records found in the current sector.</p>
          }
        </ul>
      }

      <footer class="mt-12 pt-8 border-t border-slate-900">
         <a href="#" class="text-blue-500 hover:underline">Return to Hub</a>
      </footer>
    </div>
  `
})
export class ExampleComponent {
  loading = signal(false);
  items = signal([{ id: 1, name: 'Tundra Base' }, { id: 2, name: 'Glacial Vault' }]);
  
  onReset() {}
  select(id: number) {}
}
