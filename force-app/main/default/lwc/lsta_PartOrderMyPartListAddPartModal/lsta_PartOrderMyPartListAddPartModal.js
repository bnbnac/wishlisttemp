
import { LightningElement, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

import addMyPartList from '@salesforce/apex/LSTA_PartsOrderMyPartListController.addMyPartList';
import editMyPartList from '@salesforce/apex/LSTA_PartsOrderMyPartListController.editMyPartList';

const DUPLICATED = 'duplicated';
export default class Lsta_PartOrderMyPartListAddPartModal extends LightningElement {

    columns = [
        { label: 'Part No', fieldName: 'partNo', initialWidth: 120 },
        { label: 'Old Part Number', fieldName: 'oldPartNumber', initialWidth: 150 },
        { label: 'Part Name', fieldName: 'partName', initialWidth: 200 },
        { label: 'Model Name', fieldName: 'modelName', initialWidth: 140 },
    ];

    isLoading;

    get isCreate() {
        return this.action === 'create';
    }

    get modalTitle() {
        return 'Add Part';
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

    handleDescriptionChange(event) {
        this.formValues = {
            ...this.formValues,
            description: event.target.value
        };
    }

    handleChange(event) {

    }


    async handleSearch() {
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
            console.log('payload');
            console.log(payload);
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
