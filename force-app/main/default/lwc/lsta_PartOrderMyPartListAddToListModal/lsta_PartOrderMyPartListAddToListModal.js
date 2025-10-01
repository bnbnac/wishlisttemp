import { LightningElement, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

import clonePartList from '@salesforce/apex/LSTA_PartsOrderMyPartListController.clonePartList';

export default class Lsta_PartOrderMyPartListAddToListModal extends LightningElement {

    @api selectedWishlistItems = [];
    @api listWishlist = [];
    listWishlistDataTableRows = [];

    // 얘는 부모랑 별개임. 이 모달에서 wishlist들의 id들임
    selectedRowIds = [];
    wishlistId;

    isLoading;

    
    columns = [
        { label: 'Name', fieldName: 'name', initialWidth: 400 },
    ];

    get displayNoData() { 
        return !this.listWishlist || this.listWishlist.length === 0;
    }

    connectedCallback() {
        this.wishlistId = this.selectedWishlistItems[0].WishlistId;
        this.listWishlistDataTableRows = this.listWishlist.map(item => ({
            id: item.Id,
            name: item.Name
        }));
    }
 
    handleRowSelection(event) {
        this.selectedRowIds = event.detail.selectedRows.map(row => row.id);
    }

    async handleClickSave() {
        this.isLoading = true;

        try {
            if (!this.selectedRowIds || this.selectedRowIds.length === 0) {
                this.showToast('Error', 'Please select lists to add the parts you selected.', 'error');
                return;
            }

            const selectedSet = new Set(this.selectedRowIds);
            const partList = this.listWishlist.filter(wishlist => selectedSet.has(wishlist.Id));
            
            const mapData = {
                partList: partList,
                partsListItem: this.selectedWishlistItems,
                type: 'clone',
            };
            const response = await clonePartList({ mapData });
            if (response?.result !== 'OK') {
                const message = response?.message || 'Save failed.';
                throw new Error(message);
            }
            this.showToast('Success', 'Items Added.', 'success');

            console.log(response);

            console.log('response.payload');
            console.log(response.payload);
            // 모든event에대해, mypartlist를 제조해서 넘기는건 어떨까?

            this.dispatchEvent(new CustomEvent('success', {
                detail: {
                    payload: response.payload
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