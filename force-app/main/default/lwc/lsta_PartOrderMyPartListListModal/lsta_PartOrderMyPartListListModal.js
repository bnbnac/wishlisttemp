import { LightningElement, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

import addMyPartList from '@salesforce/apex/LSTA_PartsOrderMyPartListController.addMyPartList';
import editMyPartList from '@salesforce/apex/LSTA_PartsOrderMyPartListController.editMyPartList';

const DUPLICATED = 'duplicated';
export default class Lsta_PartOrderMyPartListListModal extends LightningElement {

    @api action; // create || edit
    @api initialRecord = null;
    isLoading;

    formValues = {
        name: '',
        description: '',
        Id: ''
    };

    connectedCallback() {
        this.isLoading = true;
        if (this.action === 'edit' && this.initialRecord) {
            this.formValues = {
                name: this.initialRecord?.Name || '',
                description: this.initialRecord?.Description__c || '',
                Id: this.initialRecord?.Id || '',
            };
        }
        this.isLoading = false;
    }

    get isCreate() {
        return this.action === 'create';
    }

    get modalTitle() {
        return this.isCreate ? 'Create Wishlist' : 'Edit Wishlist';
    }

    get titleLabel() {
        return `Input the name of wishlist to ${this.action}.`;
    }

    get descriptionLable() {
        return `Input the description of wishlist to ${this.action}.`;
    }

    handleNameChange(event) {
        this.formValues = {
            ...this.formValues,
            name: event.target.value
        };
    }

    handleDescriptionChange(event) {
        this.formValues = {
            ...this.formValues,
            description: event.target.value
        };
    }

    handleClickClose() {
        this.dispatchEvent(
            new CustomEvent('close', {
                bubbles: true,
                composed: true
            })
        );
    }

    async handleClickSave() {
        this.isLoading = true;

        try {
            const trimmedName = (this.formValues.name || '').trim();

            if (!trimmedName) {
                this.showToast('Validation', 'Name is required.', 'warning');
                return;
            }

            // TODO: 클라이언트 선검증을 유지하고 싶다면 this.isDuplicated로 관리
            // if (this.isDuplicated) {
            //     this.showToast('Validation', 'Name is duplicated.', 'warning');
            //     return;
            // }

            const mapData = {
                name: trimmedName,
                description: this.formValues?.description ?? '',
                Id: this.formValues?.Id ?? '',
            };

            let response;
            if (this.isCreate) {
                response = await addMyPartList({ mapData });
            } else {
                response = await editMyPartList({ mapData });
            }

            if (response?.message === DUPLICATED) {
                this.showToast('Validation', 'A wishlist with the same name already exists.', 'warning');
                return;
            }

            if (response?.result !== 'OK') {
                const message = response?.message || 'Save failed.';
                throw new Error(message);
            }

            this.showToast('Success', 'Wishlist saved.', 'success');
            
            const payload = response?.payload ?? {};
            this.dispatchEvent(new CustomEvent('success', {
                detail: {
                    action: this.action,
                    // AccountId, CreatedById, CreatedDate, CurrencyIsoCode, Id, LastModifiedDate, Name, OwnerId, WebStoreId, WishlistProductCount 등 전체 포함
                    payload: payload
                },
                bubbles: true,
                composed: true
            }));

            this.handleClickClose();

        } catch (error) {
            const message =
                error?.body?.message ??
                error?.message ??
                'An unexpected error occurred.';
            this.showToast('Error', message, 'error');
            console.error(error);
        } finally {
            this.isLoading = false;
        }
    }

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: title,
                message: message,
                variant: variant || 'info'
            })
        );
    }
}
