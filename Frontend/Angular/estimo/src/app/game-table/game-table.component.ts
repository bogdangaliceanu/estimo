import { Component, ViewEncapsulation, OnInit, Inject } from '@angular/core';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';

import 'rxjs/add/operator/switchMap';

import { OtherPlayer } from './other-player/other-player';
import { DialogService, dialogServiceToken } from '../dialog.service';
import { GameService, gameServiceToken } from './game.service';
import { AuthService, authServiceToken } from '../auth.service';
import { Game, Round, Estimation, EstimationValue } from './game';

@Component({
    selector: 'game-table',
    templateUrl: 'game-table.component.html',
    styleUrls: ['game-table.component.css'],
    encapsulation: ViewEncapsulation.Native
})
export class GameTableComponent implements OnInit {
    private gameId: string;
    game: Game;
    selectedRound: Round;
    currentPlayerEstimationValue: EstimationValue;
    isCurrentPlayerEstimationValueOutstanding: boolean;
    otherPlayers: OtherPlayer[];
    allCardValues = [
        { text: '0', value: EstimationValue.Zero },
        { text: '1/2', value: EstimationValue.Half },
        { text: '1', value: EstimationValue.One },
        { text: '2', value: EstimationValue.Two },
        { text: '3', value: EstimationValue.Three },
        { text: '5', value: EstimationValue.Five },
        { text: '8', value: EstimationValue.Eight },
        { text: '13', value: EstimationValue.Thirteen },
        { text: '20', value: EstimationValue.Twenty },
        { text: '40', value: EstimationValue.Forty },
        { text: '100', value: EstimationValue.OneHundred },
        { text: '∞', value: EstimationValue.Infinity },
        { text: '?', value: EstimationValue.Unknown }
    ];
    unusedCardValues = this.allCardValues;

    constructor(
        private router: Router,
        private route: ActivatedRoute,
        @Inject(dialogServiceToken) private dialogService: DialogService,
        @Inject(gameServiceToken) private gameService: GameService,
        @Inject(authServiceToken) private authService: AuthService
    ) { }

    async ngOnInit() {
        this.gameId = this.getGameId();
        const result = await this.gameService.get(this.gameId);
        if (result.kind === 'success') {
            this.game = result.data;
            if (this.game.rounds.length) {
                this.selectRound(this.game.rounds[this.game.rounds.length - 1]);
            }
        }
        else {
            this.dialogService.alert(result.data);
        }
    }

    selectRound(round: Round) {
        this.selectedRound = round;
        this.showRound(round);
    }

    private showRound(round: Round) {
        const currentPlayerEstimation = round.estimations.find(e => e.player == this.authService.username);
        if (currentPlayerEstimation) {
            this.currentPlayerEstimationValue = currentPlayerEstimation.value;
            this.unusedCardValues = this.allCardValues.filter(c => c.value != this.currentPlayerEstimationValue);
        }
        else {
            this.currentPlayerEstimationValue = null;
            this.unusedCardValues = this.allCardValues
        }

        this.otherPlayers = this.getOtherPlayers(round);

        this.determineOutstandingEstimations(round);
    }

    private determineOutstandingEstimations(round: Round) {
        if (!round.consensus) {
            return;
        }

        const minValue = round.estimations.reduce((v1, v2) => v1.value < v2.value ? v1 : v2).value;
        const maxValue = round.estimations.reduce((v1, v2) => v1.value > v2.value ? v1 : v2).value;
        
        if (minValue != maxValue) {
            this.isCurrentPlayerEstimationValueOutstanding = this.currentPlayerEstimationValue === minValue || this.currentPlayerEstimationValue === maxValue;

            for (let otherPlayer of this.otherPlayers) {
                otherPlayer.estimate.isOutstanding = otherPlayer.estimate.value === minValue || otherPlayer.estimate.value === maxValue;
            }
        }
    }

    private getOtherPlayers(round: Round) {
        return round.estimations
            .filter(e => e.player != this.authService.username)
            .map(e => ({
                name: e.player,
                estimate: {
                    value: e.value
                }
            }));
    }

    getGameId() {
        let gameId: string;
        this.route.paramMap.subscribe(pm => gameId = pm.get('id')).unsubscribe();
        return gameId;
    }

    async onCardSelected(ev: DragEvent) {
        const cardValue = Number(ev.dataTransfer.getData('text')) as EstimationValue;

        const result = await this.gameService.estimate(this.gameId, cardValue);
        if (result.kind == "success") {
            this.currentPlayerEstimationValue = cardValue;
            this.selectedRound.estimations.push({ player: this.authService.username, value: cardValue });
            this.unusedCardValues = this.allCardValues.filter(c => c.value != this.currentPlayerEstimationValue);
        }
        else {
            await this.dialogService.alert(result.data);
        }
    }

    allowDrop(ev: DragEvent) {
        ev.preventDefault();
    }

    onDragStart(ev: DragEvent, cardValue: EstimationValue) {
        ev.dataTransfer.setData("text", cardValue.toString());
    }

    async newRound() {
        let subject: string;
        do {
            subject = await this.dialogService.prompt('What are you estimating?');
        }
        while (!subject);

        const result = await this.gameService.newRound(this.gameId, subject);
        if (result.kind === "success") {
            const round: Round = { subject: subject, consensus: null, estimations: [] };
            this.game.rounds.push(round);
            this.selectRound(round);
        }
        else {
            await this.dialogService.alert(result.data);
        }
    }

    async finishRound() {
        let consensus: EstimationValue;
        do {
            const consensusString = await this.dialogService.prompt('What is the consensus?');
            const match = this.allCardValues.find(v => v.text === consensusString);
            consensus = match ? match.value : null;
        }
        while (!consensus);

        const result = await this.gameService.finishRound(this.gameId, consensus);
        if (result.kind === "success") {
            this.selectedRound.consensus = consensus;
        }
        else {
            await this.dialogService.alert(result.data);
        }
    }
}