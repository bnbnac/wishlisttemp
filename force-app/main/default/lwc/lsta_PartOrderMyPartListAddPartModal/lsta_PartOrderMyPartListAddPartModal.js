
import { LightningElement, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

import addMyPartListItems from '@salesforce/apex/LSTA_PartsOrderMyPartListController.addMyPartListItems';
import searchParts from '@salesforce/apex/LSTA_PartsOrderMyPartListController.searchParts';

const DUPLICATED = 'duplicated';
export default class Lsta_PartOrderMyPartListAddPartModal extends LightningElement {

    @api myPartsListItem;
    partsList;

    searchColumns = [
        { label: 'Part No', fieldName: 'Partnum__c', initialWidth: 120 },
        { label: 'Old Part Number', fieldName: 'OldPartnum__c', initialWidth: 150 },
        { label: 'Part Name', fieldName: 'NameEng__c', initialWidth: 200 },
        { label: 'Model Name', fieldName: 'Product__r.fm_Model_Names__c', initialWidth: 140 },
    ];

    formValues = {
        partNumber: '',
        oldPartNumber: '',
        nameDescription: ''
    };

    isLoading;

    searchedList = [];
    searchedListTableRows = [];
    addedList = [];
    addedListTableRows = [];

    get isSearchedListTableRowsEmpty() { return !this.searchedListTableRows || this.searchedListTableRows.length < 1; }
    get isAddedListTableRowsEmpty() { return !this.addedListTableRows || this.addedListTableRows.length < 1; }

    handleFormChange(event) {
        const field = event.target.dataset.field;
        const value = event.target.value?.trim() ?? '';

        this.formValues = {
            ...this.formValues,
            [field]: value
        };
    }

    async handleSearchPartsToAdd() {

        const partNumber = (this.formValues.partNumber || '').trim().length >= 4 ? (this.formValues.partNumber || '').trim() : '';
        const nameDescription = (this.formValues.nameDescription || '').trim().length >= 2 ? (this.formValues.nameDescription || '').trim() : '';
        const oldPartNumber = (this.formValues.oldPartNumber || '').trim().length >= 4 ? (this.formValues.oldPartNumber || '').trim() : '';
        if (!(partNumber || nameDescription || oldPartNumber)) {
            this.showToast('Search Failed', 'Please enter at least one search criterion.', 'error');
            return;
        } 

        const mapData = {
            partNumber: partNumber,
            nameDescription: nameDescription,
            oldPartNumber: oldPartNumber
        };

        this.isLoading = true;
        try {
            const response = await searchParts({ mapData });
            const payload = response?.payload ?? [];

            this.searchedList = Array.isArray(payload) ? payload : [];
            this.convertSearchedList();
        } catch (error) {
            const message = error?.body?.message ?? error?.message ?? '검색 중 오류가 발생했습니다.';
            this.showToast('Part Search', message, 'error');
        } finally {
            this.isLoading = false;
        }
    }

    convertSearchedList() {
        this.searchedListTableRows = (this.searchedList || []).map((record) => this.toSearchedListTableRow(record));
    }
    
    toSearchedListTableRow(record) {
        const id = record?.Id ?? record?.id;
        const partNo = record?.Partnum__c ?? record?.partNo ?? '';
        const oldPartNumber = record?.OldPartnum__c ?? record?.oldPartNumber ?? '';
        const nameDescription = record?.NameEng__c || '';
        const modelName =
            record?.Product__r?.fm_Model_Names__c ??
            record?.Product__r?.ModelNames__c ??
            record?.modelName ??
            '';

        return {
            id: id,
            partNo: partNo,
            oldPartNumber: oldPartNumber,
            nameDescription: nameDescription,
            modelName: modelName,
        };
    }
    
    handleAddRow(event) {
        const rowId = event?.currentTarget?.dataset?.rowid ?? event?.target?.dataset?.rowid;
        const targetRow = this.searchedList.find(
            row => row.Id === rowId
        );
        if (!targetRow) {
            this.showToast('Not found', 'Unable to find the selected row', 'error');
            return;
        }

        const exists = this.addedList.some(
            row => row.Id === rowId
        );
        if (!exists) {
            this.addedList = [
                ...this.addedList,
                targetRow
            ];
        } else {
            this.showToast('Already Exists', 'Already exists in the Selected Parts.', 'error');
            return;
        }

        this.convertAddedList();
    }

    convertAddedList() {
        this.addedListTableRows = (this.addedList || []).map((record) => this.toAddedListTableRow(record));
    }
    
    toAddedListTableRow(record) {
        const id = record?.Id ?? record?.id;
        const partNo = record?.Partnum__c ?? record?.partNo ?? '';
        const oldPartNumber = record?.OldPartnum__c ?? record?.oldPartNumber ?? '';
        const nameDescription = record?.NameEng__c || record?.nameDescription || '';
        const quantity = record?.Quantity__c || '';
        return {
            id: id,
            partNo: partNo,
            oldPartNumber: oldPartNumber,
            nameDescription: nameDescription,
            quantity: quantity,
        };
    }

    handleRemoveRow(event) {
        const rowId = event.target.dataset.rowid;
        this.addedListTableRows = (this.addedListTableRows || []).filter(
            row => row.id !== rowId
        );
        this.addedList = (this.addedList || []).filter(
            row => row.Id !== rowId
        );
    }

    async handleClickSave() {
        this.isLoading = true;

        try {
            if (!this.addedListTableRows || this.addedListTableRows.length < 1) {
                this.showToast('No parts to add', 'Please search, select and add parts', 'error');
                return;
            }

            const invalidRow = this.addedListTableRows.find(
                row => !Number.isInteger(row.quantity) || row.quantity < 1
            );
            if (invalidRow) {
                this.showToast('Invalid Quantity', `Part No ${invalidRow.partNo} Quantity must be an integer over 0.`, 'error');
                return;
            }

            const wishlistId = this.myPartsListItem.Id;
            const mapData = {
                myPartsList: wishlistId,
                partsList: this.addedList,
            };
            const response = await addMyPartListItems({ mapData });

            if (response?.result !== 'OK') {
                const message = response?.message || 'Save failed.';
                throw new Error(message);
            }
            this.showToast('Success', 'Wishlist saved.', 'success');
            
            const payload = response?.payload ?? {};
            this.dispatchEvent(new CustomEvent('success', {
                detail: {
                    wishlistId: wishlistId,
                    // 화면갱신용 쿼리해서 payload에 넣음
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

    handleQuantityChange(event) {
        const rowId = event.target.dataset.rowid;
        const newQty = Number(event.target.value);

        this.addedListTableRows = this.addedListTableRows.map(row => {
            return row.id === rowId
                ? { ...row, quantity: newQty }
                : row;
        });
        this.addedList = this.addedList.map(item => {
            return item.Id === rowId
                ? { ...item, Quantity__c: newQty }
                : item;
        });
    }

    handleClickClose() {
        this.dispatchEvent(
            new CustomEvent('close', {
                bubbles: true,
                composed: true
            })
        );
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
