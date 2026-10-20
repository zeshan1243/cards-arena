import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { Card, SUIT_SYMBOL, cardLabel, isRed } from '../../models/card.model';

@Component({
  selector: 'app-playing-card',
  imports: [NgTemplateOutlet],
  templateUrl: './playing-card.html',
  styleUrl: './playing-card.scss',
  host: { '[class.interactive]': 'interactive()' },
})
export class PlayingCard {
  readonly card = input<Card | null>(null);
  readonly faceDown = input(false);
  readonly selected = input(false);
  readonly disabled = input(false);
  readonly playable = input(false);
  readonly hint = input(false);
  readonly interactive = input(false);
  /** `fluid` takes its width from the `--card-w` custom property of an ancestor. */
  readonly size = input<'sm' | 'md' | 'lg' | 'fluid'>('md');
  readonly cardClick = output<Card>();

  readonly symbol = computed(() => (this.card() ? SUIT_SYMBOL[this.card()!.suit] : ''));
  readonly red = computed(() => !!this.card() && isRed(this.card()!.suit));
  readonly face = computed(() => ['J', 'Q', 'K'].includes(this.card()?.rank ?? ''));
  readonly label = computed(() => {
    const c = this.card();
    if (!c || this.faceDown()) return 'Face-down card';
    return cardLabel(c) + (this.disabled() ? ' (cannot be played)' : '');
  });

  onClick(): void {
    const c = this.card();
    if (c && this.interactive() && !this.disabled()) this.cardClick.emit(c);
  }
}
